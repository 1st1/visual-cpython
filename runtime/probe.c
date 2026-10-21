/* Private, revision-pinned observation helper; not a public CPython API. */
#include "Python.h"
#include "pycore_frame.h"
#include "pycore_interpframe.h"

static PyObject *
snapshot(PyObject *self, PyObject *arg)
{
    if (!PyFrame_Check(arg)) {
        PyErr_SetString(PyExc_TypeError, "snapshot requires a paused frame");
        return NULL;
    }
    _PyInterpreterFrame *frame = ((PyFrameObject *)arg)->f_frame;
#ifdef Py_DEBUG
    if (!frame->stackpointer_valid) {
        PyErr_SetString(PyExc_RuntimeError, "frame stack is not synchronized");
        return NULL;
    }
#endif
    _PyStackRef *base = _PyFrame_Stackbase(frame);
    _PyStackRef *top = frame->stackpointer;
    if (top == NULL || top < base || top - base > 4096) {
        PyErr_SetString(PyExc_RuntimeError, "invalid or excessive operand stack");
        return NULL;
    }
    PyObject *result = PyList_New(top - base);
    if (result == NULL) return NULL;
    for (Py_ssize_t i = 0; i < top - base; i++) {
        _PyStackRef ref = base[i];
        PyObject *item;
        if (PyStackRef_IsNull(ref)) {
            item = Py_BuildValue("(sO)", "null", Py_None);
        }
        else if (PyStackRef_IsTaggedInt(ref)) {
            item = Py_BuildValue("(sL)", "tagged-int", (long long)PyStackRef_UntagInt(ref));
        }
        else {
            item = Py_BuildValue("(sO)", "object", PyStackRef_AsPyObjectBorrow(ref));
        }
        if (item == NULL) {
            Py_DECREF(result);
            return NULL;
        }
        PyList_SET_ITEM(result, i, item);
    }
    return result;
}


/* Fixed-size C records avoid allocating Python objects while parsing. */
#include <stdarg.h>
#define PARSE_LIMIT 24000
int _XRayParserEnabled = 0;
typedef struct {
    int kind, depth, cursor, end, line, column, end_line, end_column;
    void *ast_address; PyObject *ast_object;
    char text[384];
} ParseEvent;
static ParseEvent parse_events[PARSE_LIMIT];
static int parse_count, parse_dropped;
static ParseEvent *new_parse_event(int kind) {
    if (!_XRayParserEnabled) return NULL;
    if (parse_count == PARSE_LIMIT) { parse_dropped++; return NULL; }
    ParseEvent *e = &parse_events[parse_count++];
    memset(e, 0, sizeof(*e)); e->kind = kind; return e;
}
void _XRayParserLog(int depth, int cursor, int fill, const char *format, ...) {
    ParseEvent *e = new_parse_event(0); if (!e) return;
    e->depth=depth; e->cursor=cursor; e->end=fill;
    va_list args; va_start(args, format); vsnprintf(e->text, sizeof(e->text), format, args); va_end(args);
}
void _XRayParserRewind(int depth, int from, int to) {
    if (from == to) return;
    ParseEvent *e = new_parse_event(1); if (!e) return;
    e->depth=depth; e->cursor=from; e->end=to;
}
void _XRayParserToken(int index, int type, int line, int column, const char *text, int length) {
    ParseEvent *e = new_parse_event(2); if (!e) return;
    e->cursor=index; e->end=type; e->line=line; e->column=column;
    snprintf(e->text,sizeof(e->text),"%.*s",length,text);
}
void _XRayAstCreated(void *address, const char *kind, int line, int column, int end_line, int end_column) {
    ParseEvent *e = new_parse_event(3); if (!e) return;
    e->ast_address=address; e->line=line; e->column=column;
    e->end_line=end_line; e->end_column=end_column;
    snprintf(e->text,sizeof(e->text),"%s",kind);
}
void _XRayAstBind(void *address, PyObject *object) {
    if (!_XRayParserEnabled) return;
    for (int i=parse_count-1;i>=0;i--) if(parse_events[i].kind==3 && parse_events[i].ast_address==address) {
        parse_events[i].ast_object=object; return;
    }
}
static PyObject *ast_id(PyObject *self, PyObject *object) {
    for (int i=parse_count-1;i>=0;i--) if(parse_events[i].kind==3 && parse_events[i].ast_object==object) return PyLong_FromLong(i);
    Py_RETURN_NONE;
}
static PyObject *parse_begin(PyObject *self, PyObject *unused) {
    parse_count=0; parse_dropped=0; _XRayParserEnabled=1; Py_RETURN_NONE;
}
static PyObject *parse_end(PyObject *self, PyObject *unused) {
    _XRayParserEnabled=0;
    PyObject *events=PyList_New(parse_count); if (!events) return NULL;
    for (int i=0;i<parse_count;i++) {
        ParseEvent *e=&parse_events[i];
        PyObject *text=PyUnicode_DecodeUTF8(e->text,strlen(e->text),"replace");
        if (!text) { Py_DECREF(events); return NULL; }
        PyObject *item=Py_BuildValue("{s:i,s:i,s:i,s:i,s:i,s:i,s:i,s:i,s:O}",
            "kind",e->kind,"depth",e->depth,"cursor",e->cursor,"end",e->end,
            "line",e->line,"column",e->column,"end_line",e->end_line,"end_column",e->end_column,"text",text);
        Py_DECREF(text);
        if (!item) { Py_DECREF(events); return NULL; } PyList_SET_ITEM(events,i,item);
    }
    return Py_BuildValue("{s:N,s:i}","events",events,"dropped",parse_dropped);
}

static PyMethodDef methods[] = {
    {"ast_id", ast_id, METH_O, "Match a converted AST object to its captured C construction event."},
    {"parse_begin", parse_begin, METH_NOARGS, "Start bounded parser observation."},
    {"parse_end", parse_end, METH_NOARGS, "Stop parser observation and return records."},
    {"snapshot", snapshot, METH_O, "Read a synchronized frame's operand stack, bottom first."},
    {NULL, NULL, 0, NULL}
};
static struct PyModuleDef module = {
    PyModuleDef_HEAD_INIT, "_xray_probe", NULL, -1, methods
};
PyMODINIT_FUNC PyInit__xray_probe(void) { return PyModule_Create(&module); }
