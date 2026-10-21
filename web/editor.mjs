import {EditorView,basicSetup} from 'codemirror';
import {EditorState} from '@codemirror/state';
import {keymap} from '@codemirror/view';
import {indentWithTab} from '@codemirror/commands';
import {indentUnit,HighlightStyle,syntaxHighlighting} from '@codemirror/language';
import {tags} from '@lezer/highlight';
import {python} from '@codemirror/lang-python';
import {setDiagnostics} from '@codemirror/lint';

export function createSourceEditor(parent,source,onLimit){
  let syncing=false;
  const view=new EditorView({parent,doc:source.value,extensions:[
    EditorState.changeFilter.of(transaction=>{
      if(!transaction.docChanged||new TextEncoder().encode(transaction.newDoc.toString()).length<=16384)return true;
      queueMicrotask(()=>onLimit?.());return false;
    }),
    basicSetup,python(),keymap.of([indentWithTab]),indentUnit.of('    '),EditorState.tabSize.of(4),
    EditorView.contentAttributes.of({'aria-label':'Python source','aria-describedby':'editor-error'}),
    EditorView.updateListener.of(update=>{
      if(update.docChanged&&!syncing){source.value=update.state.doc.toString();queueMicrotask(()=>source.dispatchEvent(new Event('input',{bubbles:true})));}
    }),
    syntaxHighlighting(HighlightStyle.define([
      {tag:tags.keyword,color:'#cfacff'},{tag:tags.string,color:'#f1ca9d'},
      {tag:tags.number,color:'#8bded2'},{tag:tags.comment,color:'#8394ae'},
      {tag:tags.operator,color:'#b4c2de'},{tag:tags.standard(tags.name),color:'#8ecfff'},
    ])),
    EditorView.theme({
      '&':{height:'100%',color:'#e2eaff',backgroundColor:'transparent',fontSize:'14px'},
      '.cm-scroller':{fontFamily:'ui-monospace,SFMono-Regular,Consolas,monospace',lineHeight:'1.7',overflow:'auto'},
      '.cm-content':{caretColor:'#edf0f5',padding:'10px 0'},
      '.cm-gutters':{backgroundColor:'transparent',color:'#8394ae',border:'none'},
      '.cm-activeLine,.cm-activeLineGutter':{backgroundColor:'#7899cc10'},
      '&.cm-focused .cm-selectionBackground,.cm-selectionBackground':{backgroundColor:'#8fb8ff40'},
      '.cm-cursor':{borderLeftColor:'#edf0f5'},
      '.cm-tooltip':{backgroundColor:'#202036',border:'1px solid #48516a',color:'#edf0f5'},
      '.cm-diagnostic-error':{borderLeftColor:'#ee5788'},
      '&.cm-focused':{outline:'none'},
    },{dark:true}),
  ]});
  return {
    view,
    sync(){if(view.state.doc.toString()!==source.value){syncing=true;try{view.dispatch({changes:{from:0,to:view.state.doc.length,insert:source.value}});}finally{syncing=false;}}},
    focus(){view.focus();view.requestMeasure();},
    clearError(){view.dispatch(setDiagnostics(view.state,[]));view.contentDOM.removeAttribute('aria-invalid');},
    showError(result){
      const line=view.state.doc.line(Math.max(1,Math.min(result.error_location?.line||1,view.state.doc.lines)));
      const from=Math.min(line.to,line.from+Math.max(0,(result.error_location?.column||1)-1));
      view.dispatch(setDiagnostics(view.state,[{from,to:line.to,severity:'error',message:result.error}]));
      view.dispatch({selection:{anchor:from,head:line.to},effects:EditorView.scrollIntoView(from,{y:'center'})});
      view.contentDOM.setAttribute('aria-invalid','true');view.focus();
    },
  };
}
