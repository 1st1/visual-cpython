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

static PyMethodDef methods[] = {
    {"snapshot", snapshot, METH_O, "Read a synchronized frame's operand stack, bottom first."},
    {NULL, NULL, 0, NULL}
};
static struct PyModuleDef module = {
    PyModuleDef_HEAD_INIT, "_factory_probe", NULL, -1, methods
};
PyMODINIT_FUNC PyInit__factory_probe(void) { return PyModule_Create(&module); }
