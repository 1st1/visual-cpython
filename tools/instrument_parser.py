"""Apply bounded parser observation hooks to disposable pinned source exports."""
import subprocess
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DECLARATIONS = '''
extern int _FactoryParserEnabled;
extern void _FactoryParserLog(int, int, int, const char *, ...);
extern void _FactoryParserRewind(int, int, int);
extern void _FactoryParserToken(int, int, int, int, const char *, int);
'''


def instrument(source):
    revision = (ROOT / 'runtime/revision.txt').read_text().strip()
    for filename in ['Parser/parser.c', 'Parser/pegen.c', 'Python/Python-ast.c']:
        text = subprocess.check_output(['git', '-C', str(ROOT / 'cpython'), 'show', f'{revision}:{filename}'], text=True)
        text = text.replace('#include "pegen.h"', '#include "pegen.h"\n' + DECLARATIONS, 1)
        if filename.endswith('/parser.c'):
            text = text.replace('if (p->debug)', 'if (_FactoryParserEnabled)')
            text = text.replace('D(fprintf(stderr,', 'D(_FactoryParserLog(p->level, p->mark, p->fill,')
            text = text.replace('p->mark = _mark;', '_FactoryParserRewind(p->level, p->mark, _mark); p->mark = _mark;')
        elif filename.endswith('Python-ast.c'):
            text = text.replace('#include "Python.h"', '#include "Python.h"\nextern void _FactoryAstCreated(void *, const char *, int, int, int, int);\nextern void _FactoryAstBind(void *, PyObject *);')
            def constructor(match):
                body = match.group(0)
                name = re.search(r'_PyAST_(\w+)\(', body)[1]
                span = 'lineno, col_offset, end_lineno, end_col_offset' if all(name in body for name in ('int lineno', 'col_offset', 'end_lineno', 'end_col_offset')) else '0, -1, 0, -1'
                return body.replace('    return p;', f'    _FactoryAstCreated(p, "{name}", {span});\n    return p;')
            text, count = re.subn(r'\n\w+_ty\n_PyAST_\w+\([^{{]+\n\{.*?\n\}', constructor, text, flags=re.S)
            assert count > 50, count
            def bind(match):
                return match.group(0).replace('    return result;', '    _FactoryAstBind(_o, result);\n    return result;')
            text, count = re.subn(r'ast2obj_\w+\(struct ast_state \*state, void\* _o\)\n\{.*?\n\}', bind, text, flags=re.S)
            assert count > 10, count
        else:
            needle = 'int result = initialize_token(p, t, &new_token, type);'
            assert needle in text
            text = text.replace(needle, needle + '''
    if (result == 0 && _FactoryParserEnabled) {
        Py_ssize_t text_length = 0;
        const char *text = _PyToken_TextView(p->tok, &new_token, &text_length);
        _FactoryParserToken(p->fill - 1, type, t->lineno, t->col_offset,
                            text ? text : "", text ? (int)Py_MIN(text_length, 380) : 0);
    }
''')
        target = source / filename
        if target.read_text() != text:
            target.write_text(text)
