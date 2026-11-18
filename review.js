'use strict';
(()=>{
const $=id=>document.getElementById(id);
const state={items:[],decisions:{},selected:null,filtered:[],mode:'slide',auto:true,zoom:1,sub:false,family:'accent',busy:false,noteTimer:null,changed:false,modalZoom:1};
const SUB={
 vowel:[['sheva','ְ','שווא'],['hiriq','ִ','חיריק'],['tsere','ֵ','צירי'],['segol','ֶ','סגול'],['patah','ַ','פתח'],['qamats','ָ','קמץ'],['holam','ֹ','חולם'],['kubuts','ֻ','קובוץ'],['hataf-segol','ֱ','חטף סגול'],['hataf-patah','ֲ','חטף פתח'],['hataf-qamats','ֳ','חטף קמץ'],['dagesh','ּ','דגש'],['shin-dot','ׁ','נקודת שין'],['sin-dot','ׂ','נקודת שמאל']],
 accent:[['meteg','ֽ','מתג'],['merkha','֥','מרכא'],['munah','֣','מונח'],['tipha','֖','טפחא'],['etnahta','֑','אתנחתא'],['dehi','֭','דחי'],['revia','֗','רביע'],['mahapakh','֤','מהפך'],['ole','֫','עולה'],['iluy','֬','עילוי'],['geresh-muqdam','֝','גרש מוקדם'],['qadma','֨','קדמא'],['zinor','֮','צינור'],['tsinnorit','֘','צינורית'],['pazer','֡','פזר'],['shalshelet','֓','שלשלת'],['galgal','֪','ירח בן יומו'],['geresh','֜','גרש']],
 line:[['maqaf','־','מקף'],['paseq','׀','פסק'],['sof-pasuq','׃','סוף פסוק'],['rafe','ֿ','רפה']]
};
const safe=(str)=>String(str??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const countWord=n=>Number(n)===0?'no':Number(n)===1?'one':Number(n)===2?'two':String(n);
const isAnswered=id=>!!state.decisions[id]?.choice;
const transcriptionChoices={
  use_sefaria:{label:'Sefaria',field:'sef'},
  use_kit:{label:'Kit reconstruction',field:'kit'}
};
const decision=id=>state.decisions[id]||{choice:'',detail:'',note:'',corrected_text:''};
const cur=()=>state.items.find(x=>x.id===state.selected);
function msg(t,err=false){$('statusMsg').textContent=t;if(err) console.warn(t)}
function saved(text,err=false){
  $('saveState').textContent=text;
  $('saveState').classList.toggle('error',err);
  $('saveState').classList.toggle('pending',!err && /Saving|Unsaved/.test(text));
}
function showSaved(){
  if(state.changed){saved('Unsaved note');return}
  if(storageMode==='IndexedDB')saved('Saved on this device');
  else saved('Unsaved on device · back up before closing',true);
}
async function fetchReviewFile(path,type){
  const response=await fetch(path);
  if(!response.ok)throw Error('Could not download the question set.');
  return response[type]();
}
async function loadItems(){
  const batchPath='review-v980/';
  const [source,manifest]=await Promise.all([
    fetchReviewFile('review-source.html','text'),
    fetchReviewFile(batchPath+'manifest.json','json')
  ]);
  const start='<script type="application/json" id="embeddedItems">';
  const at=source.indexOf(start);
  if(at<0)throw Error('Question set is missing.');
  const end=source.indexOf('</script>',at);
  const earlier=JSON.parse(source.slice(at+start.length,end));
  const parts=await Promise.all(manifest.parts.map(part=>fetchReviewFile(batchPath+part,'json')));
  const itemsById=new Map(earlier.concat(...parts).map(item=>[item.id,item]));
  const items=manifest.ids.map(id=>itemsById.get(id));
  if(items.length!==itemsById.size||new Set(manifest.ids).size!==items.length||items.some(item=>!item)){
    throw Error('Incomplete question set.');
  }
  return items;
}
const initialAnswers=JSON.parse($('seedAnswers').textContent);
const DBNAME='TehillimSignReviewPortable-v2', LOCALKEY=DBNAME+'/state';
const seed=Object.fromEntries(initialAnswers.map(({id,...record})=>[id,record]));
let currentSource='review_v980.json';
let storageMode='memory';
let idb=null;
let backing={decisions:{...seed},history:[]};
const now=()=>new Date().toISOString();

function openIDB(){return new Promise((resolve,reject)=>{
  if(!window.indexedDB){reject(Error('IndexedDB unavailable'));return}
  const request=indexedDB.open(DBNAME,1);
  request.onupgradeneeded=()=>request.result.createObjectStore('kv');
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error);
})}

// Read and update in the same transaction so another tab's answers are preserved.
function update(change){
  if(!idb){
    const draft=JSON.parse(JSON.stringify(backing));
    const result=change(draft);
    backing=draft;
    return Promise.resolve(result);
  }
  return new Promise((resolve,reject)=>{
    const tx=idb.transaction('kv','readwrite');
    const store=tx.objectStore('kv');
    const request=store.get('state');
    let draft,result,failure;
    request.onsuccess=()=>{
      try{
        draft=request.result??backing;
        result=change(draft);
        store.put(draft,'state');
      }catch(error){failure=error;tx.abort()}
    };
    tx.oncomplete=()=>{backing=draft;resolve(result)};
    tx.onabort=()=>reject(failure||tx.error||Error('Database write aborted'));
  });
}
async function initStorage(){
  try{
    const prior=JSON.parse(localStorage.getItem(LOCALKEY));
    if(prior?.decisions)backing={decisions:{...seed,...prior.decisions},history:prior.history??[]};
  }catch(error){console.warn('Could not read older local data',error)}
  try{
    idb=await openIDB();
    await update(()=>{});
    storageMode='IndexedDB';
  }catch(error){
    idb?.close();
    idb=null;
    console.warn('IndexedDB unavailable',error);
  }
}
function saveDecision(id,patch,eventType){
  return update(draft=>{
    const old=draft.decisions[id]??null;
    const record={choice:'',detail:'',note:'',corrected_text:'',...old,...patch,updated_at:now()};
    if(eventType==='answer' && Object.hasOwn(transcriptionChoices,old?.choice) && !Object.hasOwn(transcriptionChoices,record.choice)){
      record.corrected_text='';
    }
    if(old && ['choice','detail','note','corrected_text','new_edition_count_wrong'].every(k=>old[k]===record[k]))return old;
    draft.decisions[id]=record;
    if(eventType==='answer')draft.history.push({item_id:id,before:old,event_type:eventType,undone:false,time:now()});
    return record;
  });
}
function undoDecision(){
  return update(draft=>{
    const event=[...draft.history].reverse().find(x=>x.event_type==='answer'&&!x.undone);
    if(!event)return null;
    const current=draft.decisions[event.item_id]??{};
    const prior=event.before??{};
    const record={choice:prior.choice||'',detail:prior.detail||'',note:current.note||'',corrected_text:prior.corrected_text||'',updated_at:now()};
    if(typeof current.new_edition_count_wrong==='boolean')record.new_edition_count_wrong=current.new_edition_count_wrong;
    if(record.choice||record.detail||record.note||record.corrected_text||record.new_edition_count_wrong)draft.decisions[event.item_id]=record;
    else delete draft.decisions[event.item_id];
    event.undone=true;
    return event.item_id;
  });
}
function restoreDecisions(body){
  if(!Array.isArray(body?.decisions))throw Error('Choose a Tehillim answers backup in JSON format.');
  return update(draft=>{
    let imported=0,skipped=0;
    for(const raw of body.decisions){
      const id=raw?.id||raw?.item_id;
      if(typeof id!=='string'||!id||Object.hasOwn(Object.prototype,id)){skipped++;continue}
      const existing=draft.decisions[id];
      const importFlag=typeof raw.new_edition_count_wrong==='boolean' &&
        typeof existing?.new_edition_count_wrong!=='boolean';
      if(existing?.choice){
        if(importFlag){
          existing.new_edition_count_wrong=raw.new_edition_count_wrong;
          imported++;
        }else skipped++;
        continue;
      }
      const record={choice:'',detail:'',note:'',corrected_text:'',...existing};
      if(importFlag)record.new_edition_count_wrong=raw.new_edition_count_wrong;
      for(const key of ['choice','detail','note','corrected_text','updated_at']){
        if(typeof raw[key]==='string')record[key]=raw[key];
      }
      if(typeof raw.correctedText==='string')record.corrected_text=raw.correctedText;
      if(typeof raw.notes==='string')record.note=raw.notes;
      if(typeof raw.status==='string'&&!record.choice)record.choice=raw.status;
      if(!record.choice&&!record.note&&!record.detail&&!record.corrected_text&&!record.new_edition_count_wrong){skipped++;continue}
      record.updated_at ||= now();
      draft.decisions[id]=record;
      imported++;
    }
    return {imported,skipped};
  });
}
async function exportDecisions(){
  await saveNote();
  if(state.busy||state.changed){msg('Finish saving your changes before making a backup.');return}
  const obj={schema:'tehillim-review-sqlite.v1',source:currentSource,exported_at:now(),items_in_source:state.items.length,
    decisions:Object.entries(backing.decisions).map(([id,rec])=>({id,...rec}))};
  const blob=new Blob([JSON.stringify(obj,null,2)],{type:'application/json;charset=utf-8'});
  const a=document.createElement('a');const url=URL.createObjectURL(blob);
  a.href=url;a.download='tehillim_decisions_all_'+new Date().toISOString().slice(0,10)+'.json';
  document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);
  msg('Backup includes '+obj.decisions.length+' decisions across all batches. Keep this file as a backup.');
}

const signLabels={munah:'Munach',patah:'Patach',qamats:'Kamatz',meteg:'Meteg (Meseg)'};
function populateFilters(items){
  const groups=[...new Set(items.map(item=>item.group))].sort();
  const signs=new Map(items.filter(item=>item.kind).map(item=>[item.kind,item.he]));
  $('groupFilter').replaceChildren(new Option('All groups','all'),
    ...groups.map(group=>new Option(group,group)));
  $('issueFilter').replaceChildren(new Option('All issues','all'),
    ...[...signs].sort(([a],[b])=>a.localeCompare(b)).map(([kind,he])=>{
      const label=signLabels[kind]??kind[0].toUpperCase()+kind.slice(1);
      return new Option(he?label+' · '+he:label,kind);
    }));
}
function filters(){const s=$('search').value.trim().toLocaleLowerCase();state.filtered=state.items.filter(x=>{if($('statusFilter').value==='open'&&isAnswered(x.id))return false;if($('statusFilter').value==='answered'&&!isAnswered(x.id))return false;if($('verdictFilter').value!=='all'&&x.verdict!==$('verdictFilter').value)return false;if($('groupFilter').value!=='all'&&x.group!==$('groupFilter').value)return false;if($('issueFilter').value!=='all'&&x.kind!==$('issueFilter').value)return false;return !s||[x.id,x.heref,x.he,x.kind,x.group,String(x.ps),String(x.v)].some(v=>String(v||'').toLocaleLowerCase().includes(s))});if(!state.filtered.some(x=>x.id===state.selected))state.selected=state.filtered[0]?.id||null}
function progress(){const n=state.items.filter(x=>isAnswered(x.id)).length;$('counter').textContent=n+' / '+state.items.length+' answered';$('meterFill').style.width=(state.items.length?(100*n/state.items.length):0)+'%';const i=state.filtered.findIndex(x=>x.id===state.selected);$('position').textContent=state.filtered.length?`${i+1} / ${state.filtered.length}`:'0 / 0';$('prev').disabled=i<=0;$('next').disabled=i<0||i>=state.filtered.length-1}
function options(it){const sources=[['P','old print (kit)'],['T','Sefaria'],['N','new edition']];const map=new Map();for(const [key,label] of sources){const n=String(it[key]??'');if(!map.has(n))map.set(n,[]);map.get(n).push(label)}const result=Array.from(map.entries()).sort((a,b)=>Number(a[0])-Number(b[0])).map(([n,labels])=>({key:'count:'+n,sources:labels.map(label=>label==='old print (kit)'?'Kit':label).join(' + '),label:`The old print has ${countWord(n)} ${it.he||it.kind||'sign'}${Number(n)>1?' marks':''}`,sub:`As ${labels.join(' & ')} indicate${labels.length>1?'':'s'}`}));result.push({key:'other_sign',label:'It is a different sign',sub:'Choose the vowel or accent you see in the original scan'});result.push({key:'other',label:'Something else',sub:'Explain in a note'});result.push({key:'unclear',label:'Cannot tell from this scan',sub:'Requires closer examination of the book'});return result}
const landscapePhone=matchMedia('(max-width: 920px) and (pointer: coarse) and (orientation: landscape)');
function placeComparison(){
  const comparison=$('comparison');
  const target=$(landscapePhone.matches?'comparisonLandscape':'comparisonDefault');
  if(comparison&&target)target.append(comparison);
}
landscapePhone.addEventListener('change',placeComparison);
function chosen(it,o){const d=decision(it.id);return d.choice===o.key}
function gallery(it){const examples=[['scan','Old print · scanned'],['ned','New edition'],['reb','Kit reconstruction']];return `<div class="gallery" id="gallery" style="--zoom:${state.zoom}">${examples.map(([key,name])=>`<figure class="${key==='reb'?'kitfigure':''}"><figcaption>${name}</figcaption><div class="crop ${!it[key]?'noimage':''}" data-zoom-image="${key}" role="${it[key]?'button':'generic'}" tabindex="${it[key]?'0':'-1'}" aria-label="Enlarge ${name}">${it[key]?`<img loading="eager" alt="${safe(name)} ${safe(it.heref)}" src="${it[key]}">`:'Image not available'}</div></figure>`).join('')}</div><div class="zoomRow"><button type="button" id="imageMismatch" aria-pressed="${decision(it.id).choice==='image_mismatch'}">Pictures don’t match</button><label id="zoomLabel">${Math.round(state.zoom*100)}% zoom</label><button type="button" id="zminus" aria-label="Zoom out">−</button><button type="button" id="zplus" aria-label="Zoom in">+</button><button type="button" id="zreset">Reset</button></div>`}
function transcriptionOptions(item,selected){
  return `<div class="wordbox">${Object.entries(transcriptionChoices).map(([choice,{label,field}])=>{
    const word=item[field];
    const available=typeof word==='string'&&word.trim()!=='';
    return `<div class="transcription" data-transcription="${choice}" data-accepted="${selected===choice}">
      <button type="button" class="label" aria-pressed="${selected===choice}" ${available?'':'disabled'}>${selected===choice?'Accepted':'Use'} ${label}</button>
      <div class="word" lang="he" dir="rtl">${safe(available?word:'—')}</div>
    </div>`;
  }).join('')}</div>`;
}
function renderSlide(){const box=$('slideView');if(!state.selected){box.innerHTML='<div class="empty">No items match these filters. Change a filter to see more.</div>';progress();return}const it=cur();if(!it){box.innerHTML='<div class="empty">Select an item.</div>';return}const d=decision(it.id);const opts=options(it);
box.innerHTML=`<article class="review" data-id="${safe(it.id)}"><div class="reviewHead"><span class="ref">Psalm ${it.ps}:${it.v}</span><span class="hebref" lang="he" dir="rtl">${safe(it.heref)}</span><span class="badge ${it.verdict==='C'?'c':''}">Verdict ${safe(it.verdict)}</span>${isAnswered(it.id)?'<span class="badge done">Answered</span>':''}<span class="page">Page ${it.page} · ${safe(it.id)}</span></div>
<div class="slidegrid"><div class="visuals">${gallery(it)}<div id="comparisonLandscape"></div></div><div class="inspector"><div class="signline"><b>${safe(it.he||it.kind)}</b><span class="signhe" dir="rtl">${safe(it.kind)}</span></div><div id="comparisonDefault"><div id="comparison">${transcriptionOptions(it,d.choice)}</div></div><div class="counts"><div>Sefaria<b>${safe(it.T)}</b></div><div>Old print (kit)<b>${safe(it.P)}</b></div><button type="button" id="newEditionFlag" aria-pressed="${Boolean(d.new_edition_count_wrong)}" aria-label="Flag incorrect new-edition count, reported as ${safe(it.N)}" title="Flag an incorrect count for the new edition">New edition<span><b>${safe(it.N)}</b> <small>${d.new_edition_count_wrong?'Flagged':'Flag count'}</small></span></button></div><div class="pattern">${safe(it.pattern)}</div><div class="question">What does the original print actually show?</div><div class="choices" role="group" aria-label="Choose what the old print shows">${opts.map((o,i)=>`<button type="button" class="answer" data-choice="${safe(o.key)}" aria-pressed="${chosen(it,o)}"><span class="digit">${i+1}</span><span><b class="full-choice">${safe(o.label)}</b><b class="compact-choice">${safe(o.key.startsWith('count:') ? o.key.slice(6)+(o.key==='count:1'?' mark':' marks') : ({other_sign:'Different sign',other:'Other / note',unclear:'Unclear'}[o.key]))}</b>${o.sources?`<span class="source-hint">${safe(o.sources)}</span>`:''}<span class="hint">${safe(o.sub)}</span></span></button>`).join('')}</div><div id="subpick" class="subpicker" ${!state.sub&&!d.detail?'hidden':''}></div>
<details class="note-panel"><summary>Note</summary><div class="notehead"><label for="note">Note (optional, saved locally)</label><span id="noteStatus" class="small"></span></div><textarea class="notes" id="note" placeholder="For example: appears to be a munah, not a merkha."></textarea>
<div class="footactions"><span class="meta" id="selectionLabel">${isAnswered(it.id)?'Recorded answer: '+safe(transcriptionChoices[d.choice]?.label??(d.choice==='image_mismatch'?'Pictures don’t match':d.choice+(d.detail?' / '+d.detail:''))):'Not answered yet'}</span><button type="button" id="saveNote">Save note</button></div></details></div></div></article>`;
placeComparison();
$('newEditionFlag').addEventListener('click',toggleNewEditionFlag);
$('imageMismatch').addEventListener('click',()=>choose('image_mismatch'));
for(const tile of box.querySelectorAll('[data-transcription]')){
  const button=tile.querySelector('button');
  tile.addEventListener('click',event=>{
    if(button.disabled)return;
    if(event.target!==button && window.getSelection()?.toString())return;
    choose(tile.dataset.transcription);
  });
}
$('note').value=d.note||'';$('note').addEventListener('input',()=>{state.changed=true;saved('Unsaved note');$('noteStatus').textContent='Editing…';clearTimeout(state.noteTimer);state.noteTimer=setTimeout(()=>saveNote(),700)});
$('note').addEventListener('blur',()=>{if(state.changed)saveNote()});$('saveNote').addEventListener('click',()=>saveNote());
for(const el of box.querySelectorAll('[data-choice]'))el.addEventListener('click',()=>choose(el.dataset.choice));
for(const el of box.querySelectorAll('[data-zoom-image]')){const fn=()=>{if(it[el.dataset.zoomImage])openImage(it,el.dataset.zoomImage)};el.addEventListener('click',fn);el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();fn()}})}
$('zminus').addEventListener('click',()=>zoomBy(-.25));$('zplus').addEventListener('click',()=>zoomBy(.25));$('zreset').addEventListener('click',()=>zoomBy(1-state.zoom));
if(d.detail||state.sub)renderSubpicker();progress();}
function renderSubpicker(){const node=$('subpick');if(!node)return;node.hidden=false;const current=decision(state.selected);node.innerHTML=`<h3>Which sign is visible in the old print?</h3><div class="subtabs"><button type="button" data-family="accent" class="${state.family==='accent'?'active':''}">טעמים · Accents</button><button type="button" data-family="vowel" class="${state.family==='vowel'?'active':''}">ניקוד · Vowels</button><button type="button" data-family="line" class="${state.family==='line'?'active':''}">Other marks</button><button type="button" id="subCancel" title="Close sign picker">Close</button></div><div class="subgrid">${SUB[state.family].map((x,i)=>`<button type="button" data-sign="${safe(state.family+':'+x[0])}" class="${current.detail===state.family+':'+x[0]?'active':''}"><span class="glyph" lang="he" dir="rtl">◌${x[1]}</span><span class="he" lang="he">${x[2]}</span>${i<9?`<span class="keyno">key ${i+1}</span>`:''}</button>`).join('')}</div>`;
for(const btn of node.querySelectorAll('[data-family]'))btn.addEventListener('click',()=>{state.family=btn.dataset.family;renderSubpicker()});
for(const btn of node.querySelectorAll('[data-sign]'))btn.addEventListener('click',()=>choose('other_sign',btn.dataset.sign));
$('subCancel').addEventListener('click',()=>{state.sub=false;node.hidden=true})}
function renderList(){const el=$('listView');el.innerHTML='';if(!state.filtered.length){el.innerHTML='<div class="empty">No items match the current filters.</div>';return}const fragment=document.createDocumentFragment();for(const it of state.filtered){const b=document.createElement('button');b.type='button';b.className='listItem';b.setAttribute('aria-current',String(it.id===state.selected));b.innerHTML=`<span class="top"><span class="ref">${safe(it.heref)}</span><span class="badge ${isAnswered(it.id)?'done':''}">${isAnswered(it.id)?'Answered':'Unanswered'}</span></span><span class="word" lang="he">${safe(it.sef)}</span><span class="meta">${safe(it.he||it.kind)} · ${safe(it.verdict)} · page ${safe(it.page)}</span>`;b.addEventListener('click',async()=>{await saveNote();if(state.changed||state.busy)return;state.selected=it.id;state.mode='slide';state.sub=false;render();showCardTop()});fragment.appendChild(b)}el.appendChild(fragment)}
function render(){filters();document.body.classList.toggle('slide-mode',state.mode==='slide');$('modeBtn').textContent=state.mode==='slide'?'Slide mode':'List mode';$('modeBtn').setAttribute('aria-pressed',state.mode==='slide'?'true':'false');$('autoBtn').textContent='Auto-next: '+(state.auto?'ON':'OFF');$('autoBtn').setAttribute('aria-pressed',String(state.auto));$('slideView').hidden=state.mode!=='slide';$('listView').hidden=state.mode==='slide';if(state.mode==='slide')renderSlide();else{renderList();progress()}}
function zoomBy(x){state.zoom=Math.max(.6,Math.min(4,Math.round((state.zoom+x)*100)/100));const gallery=$('gallery');if(gallery)gallery.style.setProperty('--zoom',state.zoom);const text=$('zoomLabel');if(text)text.textContent=Math.round(state.zoom*100)+'% zoom'}
async function saveNote(){
  if(!state.changed||state.busy)return;
  const field=$('note');
  if(!field)return;
  clearTimeout(state.noteTimer);
  const id=state.selected,note=field.value;
  state.changed=false;
  saved('Saving note…');
  try{
    await saveDecision(id,{note},'edit');
    state.decisions=backing.decisions;
    showSaved();
    if($('note')===field&&!state.changed)$('noteStatus').textContent=storageMode==='IndexedDB'?'Saved':'Session only';
  }catch(error){
    if($('note')===field)state.changed=true;
    saved('Unsaved note · tap Save note to retry',true);
    msg('Could not save note: '+error.message,true);
  }
}
function showCardTop(){
  if(!matchMedia('(max-width: 920px) and (pointer: coarse)').matches){
    window.scrollTo(0,0);
    return;
  }
  document.body.classList.remove('options-open');
  $('reviewMenu').setAttribute('aria-expanded','false');
  const pane=$('slideView');
  pane.scrollTop=0;
  window.scrollTo(0,0);
}
$('reviewMenu').addEventListener('click',()=>{
  const open=document.body.classList.toggle('options-open');
  $('reviewMenu').setAttribute('aria-expanded',String(open));
});
function nextOpen(id){
  const start=state.filtered.findIndex(item=>item.id===id);
  for(let offset=1;offset<state.filtered.length;offset++){
    const item=state.filtered[(start+offset)%state.filtered.length];
    if(!isAnswered(item.id))return item;
  }
  return null;
}
async function toggleNewEditionFlag(){
  if(state.busy)return;
  const item=cur();
  if(!item)return;
  const button=$('newEditionFlag');
  const flagged=!decision(item.id).new_edition_count_wrong;
  state.busy=true;
  saved('Saving flag…');
  try{
    await saveDecision(item.id,{new_edition_count_wrong:flagged},'flag');
    state.decisions=backing.decisions;
    button.setAttribute('aria-pressed',String(flagged));
    button.querySelector('small').textContent=flagged?'Flagged':'Flag count';
    showSaved();
  }catch(error){
    saved('Flag could not be saved · tap to retry',true);
    msg('Could not save new-edition count flag: '+error.message,true);
  }finally{
    state.busy=false;
    if(state.changed)saveNote();
  }
}
async function choose(choice,detail=''){
  const item=cur();
  if(!item||state.busy)return;
  if(choice==='other_sign'&&!detail){
    state.sub=true;
    state.family=decision(item.id).detail?.split(':')[0]||'accent';
    renderSubpicker();
    return;
  }
  const transcription=Object.hasOwn(transcriptionChoices,choice)?transcriptionChoices[choice]:null;
  const correctedText=transcription?item[transcription.field]:null;
  if(transcription&&(typeof correctedText!=='string'||!correctedText.trim()))return;
  clearTimeout(state.noteTimer);
  state.busy=true;
  const note=$('note')?.value??decision(item.id).note;
  saved('Saving answer…');
  try{
    await saveDecision(item.id,{choice,detail,note,...(transcription?{corrected_text:correctedText}:{})},'answer');
    state.decisions=backing.decisions;
    state.changed=false;
    state.sub=false;
    const next=state.auto&&choice!=='other'?nextOpen(item.id):null;
    if(next)state.selected=next.id;
    else if($('statusFilter').value==='open')$('statusFilter').value='all';
    render();
    showSaved();
    showCardTop();
    if(choice==='other'){const field=$('note');if(field){field.closest('details').open=true;field.focus()}msg('Add a note explaining what you see.')}
    else if(state.auto&&!next)msg('Every matching item is answered.');
  }catch(error){
    saved('Unsaved answer · tap your choice to retry',true);
    msg('Could not save answer: '+error.message,true);
  }finally{state.busy=false}
}
async function move(dir){
  if(state.busy)return;
  await saveNote();
  if(state.changed)return;
  const position=state.filtered.findIndex(item=>item.id===state.selected);
  const target=state.filtered[position+dir];
  if(!target)return;
  state.selected=target.id;
  state.sub=false;
  render();
  showCardTop();
}
async function undo(){
  if(state.busy)return;
  await saveNote();
  if(state.changed)return;
  state.busy=true;
  saved('Saving undo…');
  try{
    const id=await undoDecision();
    showSaved();
    if(!id){msg('No earlier answer to undo.');return}
    state.decisions=backing.decisions;
    if(state.items.some(item=>item.id===id)){
      $('statusFilter').value='all';
      $('search').value='';
      $('groupFilter').value='all';
      $('issueFilter').value='all';
      $('verdictFilter').value='all';
      state.selected=id;
      state.mode='slide';
      state.sub=false;
      render();
      showCardTop();
    }
    msg('Restored the answer before your last decision.');
  }catch(error){saved('Undo could not be saved',true)}
  finally{state.busy=false}
}
function openImage(it,key){$('modalImage').src=it[key];$('modalTitle').textContent=({scan:'Old print',ned:'New edition',reb:'Kit reconstruction'}[key]||'Scan')+' · '+it.heref;state.modalZoom=1;modalApply();$('imgModal').showModal()}
function modalApply(){$('modalImage').style.height=Math.round(240*state.modalZoom)+'px';$('modalZoomLabel').textContent=Math.round(state.modalZoom*100)+'%'}
async function doImport(file){
  if(!file||state.busy)return;
  try{
    const backup=JSON.parse(await file.text());
    if(!confirm('Restore missing answers from this backup? Existing answers will be kept.'))return;
    await saveNote();
    if(state.changed||state.busy)return;
    state.busy=true;
    try{
      saved('Saving restored answers…');
      const result=await restoreDecisions(backup);
      state.decisions=backing.decisions;
      render();
      showSaved();
      msg('Restored '+result.imported+' decisions. Skipped '+result.skipped+' existing or invalid entries.');
    }finally{state.busy=false}
  }catch(error){msg('Could not restore backup: '+error.message,true);showSaved()}
}
async function changeView(change){
  if(state.busy)return;
  await saveNote();
  if(state.changed)return;
  change();
  render();
}
function toggleMode(){return changeView(()=>{state.mode=state.mode==='slide'?'list':'slide'})}
function toggleAuto(){
  state.auto=!state.auto;
  $('autoBtn').textContent='Auto-next: '+(state.auto?'ON':'OFF');
  $('autoBtn').setAttribute('aria-pressed',String(state.auto));
}
function isTyping(e){const t=e.target;return t&&(['INPUT','TEXTAREA','SELECT'].includes(t.tagName)||t.isContentEditable)}
function keyboard(e){if(e.ctrlKey||e.metaKey||e.altKey||state.busy||isTyping(e)||$('imgModal').open)return;const k=e.key;if(k==='ArrowRight'||k.toLowerCase()==='j'){e.preventDefault();move(1)}else if(k==='ArrowLeft'||k.toLowerCase()==='k'){e.preventDefault();move(-1)}else if(k.toLowerCase()==='u'||k==='Backspace'){e.preventDefault();undo()}else if(k.toLowerCase()==='a'){e.preventDefault();toggleAuto()}else if(k.toLowerCase()==='s'){e.preventDefault();toggleMode()}
else if(k==='Escape'){state.sub=false;if($('subpick'))$('subpick').hidden=true}else if(/^[1-9]$/.test(k)&&state.mode==='slide'){e.preventDefault();if(state.sub){const signs=$('subpick')?.querySelectorAll('[data-sign]');const el=signs?.[Number(k)-1];if(el)el.click()}else{const opts=$('slideView').querySelectorAll('[data-choice]');const el=opts[Number(k)-1];if(el)el.click()}}}
$('modeBtn').addEventListener('click',toggleMode);$('autoBtn').addEventListener('click',()=>{toggleAuto()});$('prev').addEventListener('click',()=>move(-1));$('next').addEventListener('click',()=>move(1));$('undoBtn').addEventListener('click',undo);for(const id of ['statusFilter','groupFilter','issueFilter','verdictFilter','search'])$(id).addEventListener('input',()=>changeView(()=>{state.sub=false}));
$('exportBtn').addEventListener('click',exportDecisions);$('importBtn').addEventListener('click',()=> $('importFile').click());$('importFile').addEventListener('change',async e=>{await doImport(e.target.files[0]);e.target.value='' });
$('batchBtn').addEventListener('click',()=>$('batchFile').click());
$('batchFile').addEventListener('change',async e=>{
  const file=e.target.files[0];if(!file)return;
  try{await saveNote();if(state.changed||state.busy)return;const items=JSON.parse(await file.text());if(!Array.isArray(items)||!items.length)throw Error('Not a review-item JSON array');
    if(new Set(items.map(x=>x.id)).size!==items.length||items.some(x=>!x.id||typeof x.id!=='string'))throw Error('Review item IDs must be unique and non-empty');
    state.items=items;currentSource=file.name;
    populateFilters(items);
    $('statusFilter').value='open';$('verdictFilter').value='all';$('search').value='';state.selected=items.find(x=>!isAnswered(x.id))?.id||items[0].id;
    state.sub=false;render();msg('Loaded '+items.length+' questions from '+file.name+' for this session. Saved answers follow by ID. Reload restores the website’s default batch.');
  }catch(err){msg('Could not open batch: '+err.message,true)}
  e.target.value='';
});
document.addEventListener('keydown',keyboard);
document.addEventListener('visibilitychange',()=>{if(document.hidden)saveNote()});
$('modalClose').addEventListener('click',()=> $('imgModal').close());$('modalPlus').addEventListener('click',()=>{state.modalZoom=Math.min(6,state.modalZoom+.5);modalApply()});$('modalMinus').addEventListener('click',()=>{state.modalZoom=Math.max(.5,state.modalZoom-.5);modalApply()});$('imgModal').addEventListener('click',e=>{if(e.target===$('imgModal'))$('imgModal').close()});
let sx=0,sy=0;const slide=$('slideView');slide.addEventListener('touchstart',e=>{if(e.touches.length===1){sx=e.touches[0].clientX;sy=e.touches[0].clientY}},{passive:true});slide.addEventListener('touchend',e=>{if(e.changedTouches.length!==1||state.sub||state.changed)return;const target=e.target;if(target.closest('button,textarea,input,.crop,.gallery'))return;const dx=e.changedTouches[0].clientX-sx,dy=e.changedTouches[0].clientY-sy;if(Math.abs(dx)>95&&Math.abs(dx)>Math.abs(dy)*2)move(dx<0?1:-1)},{passive:true});
(async()=>{try{const [items]=await Promise.all([loadItems(),initStorage()]);state.items=items;state.decisions=backing.decisions;populateFilters(items);state.selected=items.find(x=>!isAnswered(x.id))?.id||items[0]?.id;render();showSaved();msg('Loaded '+items.length+' review items; '+items.filter(x=>isAnswered(x.id)).length+' already answered from earlier work.')}catch(e){saved('Cannot open local review data',true);$('slideView').innerHTML='<div class="empty">Review data could not be loaded. '+safe(e.message)+'</div>'}})();
})();
