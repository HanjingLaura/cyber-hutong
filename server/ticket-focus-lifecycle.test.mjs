import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
function fixture(){
 const nodes=[],document={activeElement:null,body:null,createElement:()=>new Element(),querySelector:selector=>selector==='.world'?world:selector==='#memory-ticket'?nodes.find(n=>n.id==='memory-ticket')??null:selector==='dialog[open]'?nodes.find(n=>n.open)??null:null};
 class Element extends EventTarget{
  children=[];isConnected=true;open=false;focus(){document.activeElement=this;}setAttribute(){}append(...children){this.children.push(...children);}replaceChildren(...children){this.children=children;}contains(node){return node===this||this.children.some(n=>n.contains(node));}showModal(){this.open=true;this.focus();}close(){this.open=false;this.dispatchEvent(new Event('close'));}constructor(){super();nodes.push(this);}
 }
 document.body=new Element();const world=new Element(),opener=new Element();opener.focus();const focusExports={};
 const run=(name,exports,require)=>runInNewContext(ts.transpileModule(readFileSync(new URL('../src/'+name,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require,document,URL,Blob});
 run('world-focus.ts',focusExports,()=>({}));const exports={};run('ticket-view.ts',exports,name=>name==='./world-focus'?focusExports:name==='./ticket-art'?{ticketDesign:()=>({passenger:'Sid'}),loadTicketAtlas:()=>new Promise(()=>{})}:{});
 exports.showMemoryTicket({role:'sid'});return{document,world,opener,Element,dialog:nodes.find(n=>n.id==='memory-ticket')};
}
for(const newer of ['chat','dialog'])test(`closing an old ticket preserves focus in newer ${newer}`,()=>{
 const f=fixture(),next=new f.Element();if(newer==='dialog')next.showModal();next.focus();f.dialog.close();assert.equal(f.document.activeElement,next);
});
test('closing a ticket returns focus to the world when no newer UI owns it',()=>{
 const f=fixture();f.dialog.close();assert.equal(f.document.activeElement,f.world);
});
