// B ARCH 2025-30 CLASS FUND MANAGEMENT
// Student-wise Category + Add All Students + Cart
// Existing PAYMENTS / EXPENSES / opening balance history are preserved.

const STUDENTS = [
"ARUN A","AYISHA NALAKATH","AYISHA RIDHA E","DIVANI PP",
"FAHIM M FAISAL","FARSEENA V","FATHIMA BAYAN","FATHIMA HAIZA CMK",
"FATHIMA HAMDAH P","FATHIMA HIBA PE","FATHIMA NASRIN K",
"FATHIMA NIDHA K P","FATHIMA RASHFIN TA","FATHIMA RENA KC",
"FATHIMA RIZA TE","FATHIMATHUL ASNA M","HIBA SHARIN KT",
"JAZL AHMAD PM","KADEEJA JOUNA C","LIYA EP","LIYA MEHJABIN",
"MEERA U","MINHA K","MOHAMMED BASITH","MUHAMMED ADEEB VM",
"MUHAMMED ARSHAK K","MUHAMMED ASIF PARI","MUHAMMED LIYAN P",
"MUHAMMED NAVEDUL ANJOOM AT","MUHAMMED RAYAN M","MUHAMMED SHAN K",
"NADHA MEHJABIN V","NAFIDA VP","NAJA FATHIMA","NAJMA V",
"NAMITHA M","NASHVA PV","RENA MEHRIN AM","RIMA FATHIMA",
"RINSHA SHANAVAS","RIYA FIBIN P","SANA N",
"SHAFRIN RAHMAN ALYATHODI","SHAHEEM NADUTHODI",
"SHAIMA SHIREEN K","SHEBA IQBAL","SHEMIL MUHAMMED",
"SHINA FATHIMA CK","FATHIMA JUNNA K.K","FATHIMA SHAHNA M",
"JYOTSNA RAJ","RAHMA K.","SANA K.","SHAHDHA A.K","ZENHA FATHIMA"
];
const AUTHORIZED_EMAIL = "ar1650@ekc.edu.in";

/**
 * Web app entry:
 * - Normal browser visits show the legacy Apps Script UI (if Index.html exists).
 * - ?api=1 enables the JSONP bridge used by the GitHub Pages PWA.
 */
function doGet(e) {
  if (e && e.parameter && e.parameter.api === '1') return handlePwaApi_(e);
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('ARMAADHA')
    .addMetaTag('viewport','width=device-width, initial-scale=1');
}


function pushAppNotification_(recipient, role, title, message, type) {
  var props = PropertiesService.getScriptProperties();
  var key = 'ARMAADHA_NOTIFICATIONS';
  var rows = [];
  try { rows = JSON.parse(props.getProperty(key) || '[]'); } catch (e) { rows = []; }
  rows.unshift({
    id: Utilities.getUuid(), recipient: String(recipient || '*'),
    role: String(role || 'admin'), title: String(title || 'Notification'),
    message: String(message || ''), type: String(type || 'info'),
    createdAt: new Date().toISOString(), read: false
  });
  if (rows.length > 400) rows = rows.slice(0, 400);
  props.setProperty(key, JSON.stringify(rows));
}
function getAppNotifications_(session) {
  var rows = [];
  try { rows = JSON.parse(PropertiesService.getScriptProperties().getProperty('ARMAADHA_NOTIFICATIONS') || '[]'); } catch (e) {}
  return rows.filter(function(n) {
    return n.role === session.role &&
      (n.recipient === '*' || String(n.recipient).toUpperCase() === String(session.username).toUpperCase());
  }).slice(0, 50);
}
function markAppNotificationRead_(session, id) {
  var props = PropertiesService.getScriptProperties(), key = 'ARMAADHA_NOTIFICATIONS';
  var rows = [];
  try { rows = JSON.parse(props.getProperty(key) || '[]'); } catch (e) {}
  rows.forEach(function(n) {
    if (n.id === String(id) &&
      (n.recipient === '*' || String(n.recipient).toUpperCase() === String(session.username).toUpperCase()) &&
      n.role === session.role) n.read = true;
  });
  props.setProperty(key, JSON.stringify(rows));
  return {ok:true};
}

// Private Drive-backed profile photos. Files remain private in the script owner's Drive;
// access is mediated by the authenticated PWA session, not public sharing links.
function getProfilePhotoFolder_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('ARMAADHA_PROFILE_PHOTO_FOLDER_ID');
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (e) {}
  }
  var folder = DriveApp.createFolder('ARMAADHA_PROFILE_PHOTOS');
  props.setProperty('ARMAADHA_PROFILE_PHOTO_FOLDER_ID', folder.getId());
  return folder;
}
function profilePhotoFileName_(session) {
  return String(session.username || '').toUpperCase().replace(/[^A-Z0-9_-]/g, '_') + '.jpg';
}
function getMyProfilePhoto_(session) {
  var folder = getProfilePhotoFolder_(), name = profilePhotoFileName_(session);
  var files = folder.getFilesByName(name);
  if (!files.hasNext()) return { ok: true, dataUrl: '' };
  var file = files.next(), blob = file.getBlob();
  return { ok: true, dataUrl: 'data:' + (blob.getContentType() || 'image/jpeg') + ';base64,' + Utilities.base64Encode(blob.getBytes()) };
}
function saveMyProfilePhoto_(session, dataUrl) {
  if (!dataUrl || dataUrl.length > 30000) throw new Error('Photo data is too large. Choose a smaller image.');
  var match = /^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/i.exec(dataUrl);
  if (!match) throw new Error('Invalid image data. Please choose a JPG, PNG or WEBP photo.');
  var bytes = Utilities.base64Decode(match[2]);
  if (!bytes.length || bytes.length > 22000) throw new Error('Photo must be smaller than 65 KB after resizing.');
  var mime = match[1].toLowerCase() === 'png' ? 'image/png' : (match[1].toLowerCase() === 'webp' ? 'image/webp' : 'image/jpeg');
  var folder = getProfilePhotoFolder_(), name = profilePhotoFileName_(session);
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var old = folder.getFilesByName(name);
    while (old.hasNext()) old.next().setTrashed(true);
    var blob = Utilities.newBlob(bytes, mime, name);
    var file = folder.createFile(blob);
    return { ok: true, saved: true, fileId: file.getId() };
  } finally { lock.releaseLock(); }
}
function removeMyProfilePhoto_(session) {
  var folder = getProfilePhotoFolder_(), files = folder.getFilesByName(profilePhotoFileName_(session)), removed = false;
  while (files.hasNext()) { files.next().setTrashed(true); removed = true; }
  return { ok: true, removed: removed };
}


// ---------------- ARMAADHA EVENTS + COMPLETE STUDENT PROFILES ----------------
const STUDENT_PROFILE_SEED_ = [{"sl":1,"name":"ARUN","arid":"AR1679","email":"ar1679@ekc.edu.in","dob":"16/11/2007","phone":"8921826904","place":"Tirur"},{"sl":2,"name":"AYISHA NALAKATH","arid":"AR1687","email":"ar1687@ekc.edu.in","dob":"18/11/2006","phone":"9567134606","place":"Vengara"},{"sl":3,"name":"AYISHA RIDHA E","arid":"AR1658","email":"ar1658@ekc.edu.in","dob":"08/10/2004","phone":"7012737322","place":"Varangode Malappuram"},{"sl":4,"name":"DIVANI P P","arid":"AR1678","email":"ar1678@ekc.edu.in","dob":"27/10/2006","phone":"8921347377","place":"Valanchery"},{"sl":5,"name":"FAHIM M FASAL","arid":"AR1685","email":"ar1685@ekc.edu.in","dob":"19/04/2007","phone":"8089852054","place":"Tanur"},{"sl":6,"name":"FARSEENA V","arid":"AR1652","email":"ar1652@ekc.edu.in","dob":"28/01/2006","phone":"6238486495","place":"West Kodur"},{"sl":7,"name":"FATHIMA BAYAN","arid":"AR1681","email":"ar1681@ekc.edu.in","dob":"22/11/2006","phone":"7012887676","place":"Tuvvur"},{"sl":8,"name":"FATHIMA HAIZA C M K","arid":"AR1677","email":"ar1677@ekc.edu.in","dob":"06/04/2007","phone":"7510921326","place":"Tirur"},{"sl":9,"name":"FATHIMA HAMDAH P","arid":"AR1649","email":"ar1649@ekc.edu.in","dob":"26/05/2007","phone":"8943642380","place":"Wandoor"},{"sl":10,"name":"FATHIMA HIBA PE","arid":"AR1668","email":"ar1668@ekc.edu.in","dob":"21/01/2006","phone":"9744415381","place":"Kondotty"},{"sl":11,"name":"FATHIMA NASRIN K","arid":"AR1643","email":"ar1643@ekc.edu.in","dob":"12/04/2007","phone":"8848034144","place":"Puzhkattiri"},{"sl":12,"name":"FATHIMA NIDHA KP","arid":"AR1665","email":"ar1665@ekc.edu.in","dob":"19/09/2006","phone":"7356442124","place":"Panangangara"},{"sl":13,"name":"FATHIMA RASHFIN TA","arid":"AR1655","email":"ar1655@ekc.edu.in","dob":"12/11/2005","phone":"8943693610","place":"Kottapuram"},{"sl":14,"name":"FATHIMA RENA KC","arid":"AR1647","email":"ar1647@ekc.edu.in","dob":"08/12/2006","phone":"8848150831","place":"Kottakkal"},{"sl":15,"name":"FATHIMA RIZA T. E","arid":"AR1691","email":"ar1691@ekc.edu.in","dob":"28/12/2006","phone":"9633678436","place":"Tirur"},{"sl":16,"name":"FATHIMATHUL ASNA M","arid":"AR1669","email":"ar1669@ekc.edu.in","dob":"14/01/2006","phone":"8137937716","place":"Payyanur"},{"sl":17,"name":"HIBA SHARIN K T","arid":"AR1660","email":"ar1660@ekc.edu.in","dob":"13/07/2007","phone":"9567700441","place":"Melmuri 27, Malappuram"},{"sl":18,"name":"JAZL AHMAD P M","arid":"AR1689","email":"ar1689@ekc.edu.in","dob":"13/02/2007","phone":"9446718178","place":"Elamkulam"},{"sl":19,"name":"KADEEJA JOUNA C","arid":"AR1663","email":"ar1663@ekc.edu.in","dob":"06/03/2007","phone":"9778717748","place":"Valamangalam, Mongam"},{"sl":20,"name":"LIYA E P","arid":"AR1661","email":"ar1661@ekc.edu.in","dob":"18/05/2006","phone":"9496757157","place":"Wandoor"},{"sl":21,"name":"LIYA MEHJABIN","arid":"AR1688","email":"ar1688@ekc.edu.in","dob":"04/07/2007","phone":"6282922377","place":"Vengara Kacherippadi"},{"sl":22,"name":"MEERA U","arid":"AR1644","email":"ar1644@ekc.edu.in","dob":"03/04/2007","phone":"8281219355","place":"Makkaraparamba"},{"sl":23,"name":"MINHA K","arid":"AR1653","email":"ar1653@ekc.edu.in","dob":"16/03/2006","phone":"7306129605","place":"Mampad"},{"sl":24,"name":"MUHAMMED ARSHAK K","arid":"AR1659","email":"ar1659@ekc.edu.in","dob":"31/01/2007","phone":"9495312514","place":"Tirur"},{"sl":25,"name":"MOHAMMED BASITH","arid":"AR1672","email":"ar1672@ekc.edu.in","dob":"25/11/2005","phone":"8592859554","place":"Manjeri"},{"sl":26,"name":"MUHAMMED ADEEB VM","arid":"AR1662","email":"ar1662@ekc.edu.in","dob":"23/09/2006","phone":"8089032836","place":"Valavannur"},{"sl":27,"name":"MUHAMMED ASIF PARI","arid":"AR1650","email":"ar1650@ekc.edu.in","dob":"16/07/2007","phone":"8943042196","place":"Melmuri"},{"sl":28,"name":"MUHAMMED LIYAN","arid":"AR1673","email":"ar1673@ekc.edu.in","dob":"12/04/2004","phone":"7012243443","place":"Chokli, Thalassery, Kannur"},{"sl":29,"name":"MUHAMMED NAVEDUL ANJOOM AT","arid":"AR1654","email":"ar1654@ekc.edu.in","dob":"23/04/2005","phone":"9037103433","place":"Perinthalmanna"},{"sl":30,"name":"MUHAMMED RAYAN M","arid":"AR1670","email":"ar1670@ekc.edu.in","dob":"17/02/2005","phone":"9633156778","place":"Cherukode"},{"sl":31,"name":"MUHAMMED SHAN K","arid":"AR1680","email":"ar1680@ekc.edu.in","dob":"05/01/2007","phone":"9744087581","place":"Cheriparambu"},{"sl":32,"name":"NADHA MEHJABIN V","arid":"AR1657","email":"ar1657@ekc.edu.in","dob":"08/12/2006","phone":"8921257591","place":"Malappuram"},{"sl":33,"name":"NAFIDA V P","arid":"AR1676","email":"ar1676@ekc.edu.in","dob":"12/10/2006","phone":"7356033911","place":"Cherumukku"},{"sl":34,"name":"NAJA FATHIMA","arid":"AR1675","email":"ar1675@ekc.edu.in","dob":"27/05/2006","phone":"9745892509","place":"Mukkam"},{"sl":35,"name":"NAJMA","arid":"AR1640","email":"ar1640@ekc.edu.in","dob":"25/08/2007","phone":"8075920926","place":"Thirunavaya"},{"sl":36,"name":"NAMITHA M","arid":"AR1674","email":"ar1674@ekc.edu.in","dob":"03/10/2006","phone":"8590364381","place":"Melattur"},{"sl":37,"name":"NASHVA PV","arid":"AR1656","email":"ar1656@ekc.edu.in","dob":"05/12/2005","phone":"8943891205","place":"Vallikunnu, Athannikkal"},{"sl":38,"name":"RENA MEHARIN AM","arid":"AR1683","email":"ar1683@ekc.edu.in","dob":"19/04/2005","phone":"9745174697","place":"Manjeri"},{"sl":39,"name":"RIMA FATHIMA","arid":"AR1684","email":"ar1684@ekc.edu.in","dob":"28/04/2007","phone":"8943260597","place":"Kasaragod"},{"sl":40,"name":"RINSHA SHANAVAS","arid":"AR1671","email":"ar1671@ekc.edu.in","dob":"23/03/2006","phone":"8113008310","place":"Venniyoor"},{"sl":41,"name":"RIYA FIBIN P","arid":"AR1686","email":"ar1686@ekc.edu.in","dob":"21/08/2006","phone":"8281131703","place":"Kotakkal"},{"sl":42,"name":"SANA N","arid":"AR1646","email":"ar1646@ekc.edu.in","dob":"13/10/2007","phone":"9947782670","place":"Valamboor"},{"sl":43,"name":"SHAFRIN RAHMAN ALYATHODI","arid":"AR1664","email":"ar1664@ekc.edu.in","dob":"07/04/2005","phone":"7356462197","place":"Manjeri"},{"sl":44,"name":"SHAHEEM N","arid":"AR1641","email":"ar1641@ekc.edu.in","dob":"01/03/2007","phone":"6238207317","place":"Malappuram"},{"sl":45,"name":"SHAIMA SHIREEN","arid":"AR1651","email":"ar1651@ekc.edu.in","dob":"09/04/2007","phone":"7994841611","place":"Kottakkal"},{"sl":46,"name":"SHEBA IQBAL","arid":"AR1642","email":"ar1642@ekc.edu.in","dob":"26/06/2006","phone":"8590810364","place":"Manjeri"},{"sl":47,"name":"SHEMIL MOHAMMED","arid":"AR1682","email":"ar1682@ekc.edu.in","dob":"02/02/2007","phone":"7907405521","place":"Perinthalmanna"},{"sl":48,"name":"SHINA FATHIMA CK","arid":"AR1648","email":"ar1648@ekc.edu.in","dob":"10/02/2006","phone":"9778107533","place":"Mannarkkad"},{"sl":49,"name":"FATHIMA JUNNA KK","arid":"AR1700","email":"ar1700@ekc.edu.in","dob":"05/03/2007","phone":"7736668082","place":"Vailathur"},{"sl":50,"name":"FATHIMA SHAHNA M","arid":"AR1699","email":"ar1699@ekc.edu.in","dob":"11/04/2007","phone":"9496111011","place":"Othukkungal"},{"sl":51,"name":"JYOTSNA RAJ","arid":"AR1704","email":"ar1704@ekc.edu.in","dob":"22/12/2006","phone":"9778310667","place":"Vallapuzha"},{"sl":52,"name":"RAHMA K","arid":"AR1702","email":"ar1702@ekc.edu.in","dob":"22/05/2006","phone":"9947424989","place":"Povvakkode"},{"sl":53,"name":"SANA K","arid":"AR1701","email":"ar1701@ekc.edu.in","dob":"24/01/2006","phone":"7012912536","place":"Perinthalmanna"},{"sl":54,"name":"SHAHDHA AK","arid":"AR1703","email":"ar1703@ekc.edu.in","dob":"19/11/2007","phone":"9746464064","place":"Koppam"},{"sl":55,"name":"ZENHA FATHIMA","arid":"AR1705","email":"ar1705@ekc.edu.in","dob":"29/07/2007","phone":"7994125423","place":"Thalassery, Kannur"}];
function ensureStudentProfilesSheet_() {
  const ss=getSS_(); let sh=ss.getSheetByName('STUDENT_PROFILES');
  const headers=['AR ID','Student Name','College Email','Date of Birth','Phone','Place','Full Address','Guardian Name','Guardian Phone','Emergency Contact','Blood Group','Updated At'];
  if(!sh){ sh=ss.insertSheet('STUDENT_PROFILES'); sh.getRange(1,1,1,headers.length).setValues([headers]); sh.setFrozenRows(1); }
  if(sh.getLastRow()<2){
    const values=STUDENT_PROFILE_SEED_.map(x=>[x.arid,x.name,x.email,x.dob,x.phone,x.place,'','','','','',new Date()]);
    if(values.length) sh.getRange(2,1,values.length,headers.length).setValues(values);
  }
  return sh;
}
function profileRowObject_(r){
  return {arid:String(r[0]||''),name:String(r[1]||''),email:String(r[2]||''),dob:String(r[3]||''),phone:String(r[4]||''),place:String(r[5]||''),address:String(r[6]||''),guardian:String(r[7]||''),guardianPhone:String(r[8]||''),emergency:String(r[9]||''),bloodGroup:String(r[10]||'')};
}
function getProfileByArid_(arid){
  const sh=ensureStudentProfilesSheet_(), rows=sh.getDataRange().getValues();
  const key=String(arid||'').toUpperCase();
  for(let i=1;i<rows.length;i++) if(String(rows[i][0]).toUpperCase()===key) return {row:i+1,data:profileRowObject_(rows[i])};
  return null;
}
function getStudentProfile_(session, arid){
  const target=session.role==='admin'?String(arid||(String(session.username).toUpperCase()==='ASIF'?'AR1650':session.username)):String(session.username);
  const found=getProfileByArid_(target); if(!found) throw new Error('Student profile not found.');
  const data=found.data;
  const photo=getProfilePhotoByUsername_(session.role==='admin'&&!arid?session.username:target);
  data.photo=photo;
  return data;
}
function getProfilePhotoByUsername_(username){
  const folder=getProfilePhotoFolder_(), name=String(username||'').toUpperCase().replace(/[^A-Z0-9_-]/g,'_')+'.jpg';
  const files=folder.getFilesByName(name); if(!files.hasNext()) return '';
  const blob=files.next().getBlob();
  return 'data:'+(blob.getContentType()||'image/jpeg')+';base64,'+Utilities.base64Encode(blob.getBytes());
}
function saveStudentProfile_(session, profile){
  if(!profile||typeof profile!=='object') throw new Error('Invalid profile details.');
  const target=session.role==='admin'?String(profile.arid||''):String(session.username);
  const found=getProfileByArid_(target); if(!found) throw new Error('Student profile not found.');
  const sh=ensureStudentProfilesSheet_(), old=found.data;
  const fields=session.role==='admin'?['name','email','dob','phone','place','address','guardian','guardianPhone','emergency','bloodGroup']:['email','phone','place','address','guardian','guardianPhone','emergency','bloodGroup'];
  const next=Object.assign({},old);
  fields.forEach(k=>{ if(profile[k]!==undefined) next[k]=String(profile[k]).trim().slice(0,180); });
  if(next.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.email)) throw new Error('Enter a valid email address.');
  if(next.dob && !/^([0-3]\d)\/([01]\d)\/\d{4}$/.test(next.dob)) throw new Error('Date of birth must be DD/MM/YYYY.');
  sh.getRange(found.row,1,1,12).setValues([[target,next.name,next.email,next.dob,next.phone,next.place,next.address,next.guardian,next.guardianPhone,next.emergency,next.bloodGroup,new Date()]]);
  return {ok:true,profile:next};
}
function listStudentProfiles_(session){
  if(session.role!=='admin') throw new Error('Admin access required.');
  const sh=ensureStudentProfilesSheet_(), rows=sh.getDataRange().getValues();
  return rows.slice(1).filter(r=>r[0]).map(r=>profileRowObject_(r));
}
function getEventPosterFolder_(){
  var props=PropertiesService.getScriptProperties(),id=props.getProperty('ARMAADHA_EVENT_POSTER_FOLDER_ID');
  if(id){try{return DriveApp.getFolderById(id);}catch(e){}}
  var folder=DriveApp.createFolder('ARMAADHA_EVENT_POSTERS');
  props.setProperty('ARMAADHA_EVENT_POSTER_FOLDER_ID',folder.getId());
  return folder;
}
function eventPosterUrl_(fileId){return fileId?'https://drive.google.com/thumbnail?id='+encodeURIComponent(fileId)+'&sz=w1200':'';}
function trashEventPoster_(fileId){if(!fileId)return;try{DriveApp.getFileById(String(fileId)).setTrashed(true);}catch(e){}}
function ensureEventCleanupTrigger_(){
  const props=PropertiesService.getScriptProperties();
  if(props.getProperty('ARMAADHA_EVENT_CLEANUP_TRIGGER')==='1')return;
  const exists=ScriptApp.getProjectTriggers().some(t=>t.getHandlerFunction()==='cleanupExpiredEvents_');
  if(!exists)ScriptApp.newTrigger('cleanupExpiredEvents_').timeBased().everyDays(1).atHour(2).create();
  props.setProperty('ARMAADHA_EVENT_CLEANUP_TRIGGER','1');
}
function cleanupExpiredEvents_(){listEvents_();}
function ensureEventsSheet_(){
  const ss=getSS_(); let sh=ss.getSheetByName('EVENTS');
  if(!sh){sh=ss.insertSheet('EVENTS');sh.getRange(1,1,1,9).setValues([['Event ID','Title','Date','Time','Venue','Description','Created By','Created At','Poster File ID']]);sh.setFrozenRows(1);}
  else if(sh.getLastColumn()<9)sh.getRange(1,9).setValue('Poster File ID');
  ensureEventCleanupTrigger_();
  return sh;
}
function listEvents_(){
  const sh=ensureEventsSheet_(); if(sh.getLastRow()<2)return [];
  const today=Utilities.formatDate(new Date(),Session.getScriptTimeZone(),'yyyy-MM-dd');
  const rows=sh.getRange(2,1,sh.getLastRow()-1,9).getValues();
  // Expired events and their Drive posters are automatically removed when events are loaded.
  for(let i=rows.length-1;i>=0;i--){
    const date=rows[i][2] instanceof Date?Utilities.formatDate(rows[i][2],Session.getScriptTimeZone(),'yyyy-MM-dd'):String(rows[i][2]||'').slice(0,10);
    if(rows[i][0] && date && date<today){trashEventPoster_(rows[i][8]);sh.deleteRow(i+2);}
  }
  if(sh.getLastRow()<2)return [];
  return sh.getRange(2,1,sh.getLastRow()-1,9).getValues().filter(r=>r[0]).map(r=>({id:String(r[0]),title:String(r[1]),date:r[2] instanceof Date?Utilities.formatDate(r[2],Session.getScriptTimeZone(),'yyyy-MM-dd'):String(r[2]),time:String(r[3]||''),venue:String(r[4]||''),description:String(r[5]||''),posterUrl:eventPosterUrl_(r[8])})).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
}
function saveEvent_(session,event){
  if(session.role!=='admin')throw new Error('Admin access required.');
  if(!event||!String(event.title||'').trim()||!String(event.date||'').trim())throw new Error('Event title and date are required.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(event.date)))throw new Error('Choose a valid event date.');
  const sh=ensureEventsSheet_(), id=String(event.id||Utilities.getUuid()), rows=sh.getDataRange().getValues();
  let row=-1,oldPoster='';for(let i=1;i<rows.length;i++)if(String(rows[i][0])===id){row=i+1;oldPoster=String(rows[i][8]||'');break;}
  let posterId=oldPoster;
  if(event.posterDataUrl){
    const match=/^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/i.exec(String(event.posterDataUrl));
    if(!match)throw new Error('Invalid poster image. Choose JPG, PNG or WEBP.');
    const bytes=Utilities.base64Decode(match[2]);if(!bytes.length||bytes.length>22000)throw new Error('Poster size is too large. Choose a smaller image.');
    const mime=match[1].toLowerCase()==='png'?'image/png':(match[1].toLowerCase()==='webp'?'image/webp':'image/jpeg');
    const folder=getEventPosterFolder_(),blob=Utilities.newBlob(bytes,mime,'EVENT_'+id+'.jpg'),file=folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);
    posterId=file.getId();if(oldPoster)trashEventPoster_(oldPoster);
  }
  const record=[id,String(event.title).trim().slice(0,120),String(event.date),String(event.time||''),String(event.venue||'').slice(0,160),String(event.description||'').slice(0,1000),String(session.username),new Date(),posterId];
  if(row>0)sh.getRange(row,1,1,9).setValues([record]);else sh.appendRow(record);
  pushAppNotification_('*','student','New / updated event',record[1]+' — '+record[2]+(record[4]?' at '+record[4]:''),'event');
  return {ok:true,events:listEvents_()};
}
function deleteEvent_(session,id){
  if(session.role!=='admin')throw new Error('Admin access required.');
  const sh=ensureEventsSheet_(), rows=sh.getDataRange().getValues();
  for(let i=1;i<rows.length;i++)if(String(rows[i][0])===String(id)){trashEventPoster_(rows[i][8]);sh.deleteRow(i+1);return {ok:true,events:listEvents_()};}
  throw new Error('Event not found.');
}
function getDashboardExtras_(session){
  const now=new Date(), today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  const profiles=listStudentProfiles_(Object.assign({},session,{role:'admin'}));
  const birthdays=profiles.map(p=>{
    const m=String(p.dob||'').match(/^(\d{2})\/(\d{2})\/(\d{4})$/); if(!m)return null;
    const birthMonth=Number(m[2])-1,birthDay=Number(m[1]);
    if(birthMonth!==today.getMonth()||birthDay!==today.getDate())return null;
    return {name:p.name,arid:p.arid,isToday:true,photo:getProfilePhotoByUsername_(p.arid)};
  }).filter(Boolean);
  return {birthdays,events:listEvents_().slice(0,12)};
}

function handlePwaApi_(e) {
  var callback = String((e.parameter && e.parameter.callback) || '');
  if (!/^[A-Za-z_$][0-9A-Za-z_$\.]{0,80}$/.test(callback)) {
    return ContentService.createTextOutput('/* invalid callback */').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  var result;
  try {
    var action = String(e.parameter.action || '');
    var payloadText = Utilities.newBlob(Utilities.base64DecodeWebSafe(String(e.parameter.payload || ''))).getDataAsString();
    var args = payloadText ? JSON.parse(payloadText) : [];
    if (!Array.isArray(args)) throw new Error('Invalid request payload.');
    if (action === 'logout') {
      var logoutToken = String(e.parameter.token || '');
      if (logoutToken) {
        CacheService.getScriptCache().remove('PWA_SESSION_' + logoutToken);
        var logoutDigest = Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, logoutToken)).replace(/=+$/g, '');
        PropertiesService.getScriptProperties().deleteProperty('PWA_REMEMBER_' + logoutDigest);
      }
      result = { ok: true };
    } else if (action === 'logout') {
      var logoutToken = String(e.parameter.token || '');
      if (logoutToken) {
        CacheService.getScriptCache().remove('PWA_SESSION_' + logoutToken);
        var logoutDigest = Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, logoutToken)).replace(/=+$/g, '');
        PropertiesService.getScriptProperties().deleteProperty('PWA_REMEMBER_' + logoutDigest);
      }
      result = { ok: true };
    } else if (action === 'login') {
      var auth = loginAccount_(String(args[0] || ''), String(args[1] || ''));
      if (!auth) result = false;
      else {
        var token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
        CacheService.getScriptCache().put('PWA_SESSION_' + token, JSON.stringify(auth), 21600);
        var tokenDigest = Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token)).replace(/=+$/g, '');
        PropertiesService.getScriptProperties().setProperty('PWA_REMEMBER_' + tokenDigest, JSON.stringify({ auth: auth }));
        result = { ok: true, token: token, role: auth.role, name: auth.name, username: auth.username, mustChangePassword: !!auth.mustChangePassword };
      }
    } else {
      var token = String(e.parameter.token || '');
      var sessionRaw = token ? CacheService.getScriptCache().get('PWA_SESSION_' + token) : null;
      if (!sessionRaw && token) {
        var tokenDigest = Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token)).replace(/=+$/g, '');
        var rememberedRaw = PropertiesService.getScriptProperties().getProperty('PWA_REMEMBER_' + tokenDigest);
        if (rememberedRaw) {
          var remembered = JSON.parse(rememberedRaw);
          if (remembered.auth) {
            sessionRaw = JSON.stringify(remembered.auth);
            CacheService.getScriptCache().put('PWA_SESSION_' + token, sessionRaw, 21600);
          } else {
            PropertiesService.getScriptProperties().deleteProperty('PWA_REMEMBER_' + tokenDigest);
          }
        }
      }
      if (!sessionRaw) throw new Error('Session expired. Please log in again.');
      var session = JSON.parse(sessionRaw);
      // Re-check the current role on every request so a revoked admin loses access immediately.
      session.role = getAccountRole_(session.username);
      var primaryAdminOnly = ['grantAdminAccess','revokeAdminAccess','listAdminUsers'];
      if (primaryAdminOnly.indexOf(action) >= 0 && !isPrimaryAdmin_(session.username)) throw new Error('Only the primary admin can manage admin permissions.');
      var adminOnly = ['updateOpeningBalance','addPayment','addExpense','saveCategoryAssignments','removeStudentCategory','removeCategoryFromAllStudents','createStudentAccount','setStudentAccountActive','listStudentAccounts','listPendingUpiPayments','approveUpiPayment','rejectUpiPayment','editPayment','deletePayment','grantAdminAccess','revokeAdminAccess','listAdminUsers','saveEvent','deleteEvent','createFacultyAccount','setFacultyActive','deleteFacultyAccount','setStudentRole','listRoleAccounts','saveTimetableEntry','deleteTimetableEntry'];
      if (adminOnly.indexOf(action) >= 0 && session.role !== 'admin') throw new Error('Admin access required.');
      if (action === 'getMyProfilePhoto') result = getMyProfilePhoto_(session);
      else if (action === 'getMyStudentProfile') result = getStudentProfile_(session, session.username);
      else if (action === 'getStudentProfile') result = getStudentProfile_(session, args[0]);
      else if (action === 'saveStudentProfile') result = saveStudentProfile_(session, args[0]);
      else if (action === 'listStudentProfiles') result = listStudentProfiles_(session);
      else if (action === 'getDashboardExtras') result = getDashboardExtras_(session);
      else if (action === 'saveEvent') result = saveEvent_(session, args[0]);
      else if (action === 'listRoleAccounts') result = listRoleAccounts_(session);
      else if (action === 'setStudentRole') result = setStudentRole_(session, args[0], args[1]);
      else if (action === 'listFaculty') result = listFaculty_(session);
      else if (action === 'createFacultyAccount') result = createFacultyAccount_(session, args[0]);
      else if (action === 'setFacultyActive') result = setFacultyActive_(session, args[0], args[1]);
      else if (action === 'deleteFacultyAccount') result = deleteFacultyAccount_(session, args[0]);
      else if (action === 'listTimetable') result = listTimetable_(session);
      else if (action === 'saveTimetableEntry') result = saveTimetableEntry_(session, args[0]);
      else if (action === 'deleteTimetableEntry') result = deleteTimetableEntry_(session, args[0]);
      else if (action === 'listAssignments') result = listAssignments_(session);
      else if (action === 'createAssignment') result = createAssignment_(session, args[0]);
      else if (action === 'updateAssignment') result = updateAssignment_(session, args[0], args[1]);
      else if (action === 'deleteAssignment') result = deleteAssignment_(session, args[0]);
      else if (action === 'submitAssignment') result = submitAssignment_(session, args[0], args[1]);
      else if (action === 'gradeSubmission') result = gradeSubmission_(session, args[0], args[1], args[2], args[3]);
      else if (action === 'updateSubmissionStatus') result = updateSubmissionStatus_(session, args[0], args[1]);
      else if (action === 'deleteEvent') result = deleteEvent_(session, args[0]);
      else if (action === 'saveMyProfilePhoto') result = saveMyProfilePhoto_(session, String(args[0] || ''));
      else if (action === 'removeMyProfilePhoto') result = removeMyProfilePhoto_(session);
      else if (action === 'getAppNotifications') result = getAppNotifications_(session);
      else if (action === 'markAppNotificationRead') result = markAppNotificationRead_(session, args[0]);
      else if (action === 'changeMyPassword') {
         result = changeMyPassword_(session, String(args[0] || ''), String(args[1] || ''));
         CacheService.getScriptCache().remove('PWA_SESSION_' + token);
       }
       else if (['student','studio_head','class_rep'].indexOf(session.role) >= 0 && studentMustChangePassword_(session.username)) {
         throw new Error('Change your temporary password before continuing.');
       }
       else if (action === 'getDashboard' || action === 'refreshDashboard') result = getDashboardForSession_(session);
      else {
        var handlers = {
          updateOpeningBalance: updateOpeningBalance,
          addPayment: addPayment,
          addExpense: addExpense,
          saveCategoryAssignments: saveCategoryAssignments,
          removeStudentCategory: removeStudentCategory,
          removeCategoryFromAllStudents: removeCategoryFromAllStudents,
          createStudentAccount: createStudentAccount,
          setStudentAccountActive: setStudentAccountActive,
          listStudentAccounts: listStudentAccounts,
          grantAdminAccess: grantAdminAccess,
          revokeAdminAccess: revokeAdminAccess,
          listAdminUsers: listAdminUsers,
          listDriveGallery: listDriveGallery,
          submitUpiPayment: function(category, amount, utr, note){ return submitUpiPayment_(session, category, amount, utr, note); },
          listPendingUpiPayments: listPendingUpiPayments,
          approveUpiPayment: approveUpiPayment,
          rejectUpiPayment: rejectUpiPayment,
          editPayment: editPayment,
          deletePayment: deletePayment
        };
        if (!Object.prototype.hasOwnProperty.call(handlers, action)) throw new Error('Action not allowed.');
        result = handlers[action].apply(null, args);
      }
    }
  } catch (err) { result = { __error: String(err && err.message ? err.message : err) }; }
  var json = JSON.stringify(result).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  return ContentService.createTextOutput(callback + '(' + json + ');').setMimeType(ContentService.MimeType.JAVASCRIPT);
}

// Paginated gallery: each request returns a small batch to avoid Apps Script timeouts.
function listDriveGallery(folderId, filePageToken, folderPageToken) {
  const rootId = '16jM9g9-DaIjlQM-g86G-dAPKGMiktpNN';
  const currentId = String(folderId || rootId);
  const folder = DriveApp.getFolderById(currentId);
  const PAGE_SIZE = 60;
  const FOLDER_PAGE_SIZE = 30;
  const MAX_SCAN = 300;

  const fileIt = filePageToken
    ? DriveApp.continueFileIterator(filePageToken)
    : folder.getFiles();
  const folderIt = folderPageToken
    ? DriveApp.continueFolderIterator(folderPageToken)
    : folder.getFolders();

  const files = [];
  const folders = [];
  let scanned = 0;

  while (fileIt.hasNext() && scanned < MAX_SCAN && files.length < PAGE_SIZE) {
    const f = fileIt.next();
    scanned++;
    const mime = f.getMimeType();
    if (mime.indexOf('image/') !== 0 && mime.indexOf('video/') !== 0) continue;
    const id = f.getId();
    files.push({
      id: id,
      name: f.getName(),
      mimeType: mime,
      kind: mime.indexOf('video/') === 0 ? 'video' : 'image',
      modified: f.getLastUpdated().toISOString(),
      folderPath: folder.getName(),
      thumbnail: 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(id) + '&sz=w600',
      preview: 'https://drive.google.com/file/d/' + encodeURIComponent(id) + '/preview',
      openUrl: 'https://drive.google.com/file/d/' + encodeURIComponent(id) + '/view',
      downloadUrl: 'https://drive.google.com/uc?export=download&id=' + encodeURIComponent(id)
    });
  }

  let folderScanned = 0;
  while (folderIt.hasNext() && folderScanned < FOLDER_PAGE_SIZE) {
    const sub = folderIt.next();
    folders.push({
      id: sub.getId(),
      name: sub.getName(),
      kind: 'folder',
      modified: '',
      thumbnail: '',
      path: folder.getName()
    });
    folderScanned++;
  }

  return {
    files: files,
    folders: folders,
    currentFolder: { id: currentId, name: folder.getName() },
    rootId: rootId,
    count: files.length,
    nextFilePageToken: fileIt.hasNext() ? fileIt.getContinuationToken() : '',
    nextFolderPageToken: folderIt.hasNext() ? folderIt.getContinuationToken() : '',
    truncated: fileIt.hasNext(),
    foldersTruncated: folderIt.hasNext()
  };
}

const FUND_ID_FALLBACK_ = '1FYxlQy5TsMxerZrx62_xTrnJxhHjbccYH_aqvwmWhYk';
function getSS_() {
  const id = PropertiesService.getScriptProperties().getProperty('FUND_ID') || FUND_ID_FALLBACK_;
  return SpreadsheetApp.openById(id);
}

function ensureStudentCategoriesSheet_() {
  const ss=getSS_();
  let sh=ss.getSheetByName('STUDENT_CATEGORIES');
  if (!sh) {
    sh=ss.insertSheet('STUDENT_CATEGORIES');
    sh.appendRow(['Student ID','Student Name','Category','Target Amount','Created At']);
    sh.setFrozenRows(1);
  }
  return sh;
}

// Run ONCE after replacing Code.gs. This removes the old shared category list,
// creates the student-wise assignment sheet, and DOES NOT delete payment history.
function setupStudentCategorySystem() {
  const ss=getSS_();
  let cat=ss.getSheetByName('CATEGORIES');
  if (!cat) cat=ss.insertSheet('CATEGORIES');
  cat.clearContents();
  cat.getRange(1,1,1,2).setValues([['Category','Target Amount']]);
  cat.setFrozenRows(1);
  const sh=ensureStudentCategoriesSheet_();
  sh.clearContents();
  sh.getRange(1,1,1,5).setValues([['Student ID','Student Name','Category','Target Amount','Created At']]);
  sh.setFrozenRows(1);
  return 'Setup complete. Old shared categories cleared; payment and expense history preserved.';
}

function getStudentRows_() {
  const sh=getSS_().getSheetByName('STUDENTS');
  if (!sh || sh.getLastRow()<2) return [];
  return sh.getRange(2,1,sh.getLastRow()-1,4).getValues().map((r,i)=>({
    id:Number(r[0])||i+1, name:String(r[1]||''), paid:Number(r[2])||0, pending:Number(r[3])||0
  })).filter(s=>s.name);
}

function getAssignments_() {
  const sh=ensureStudentCategoriesSheet_();
  if (sh.getLastRow()<2) return [];
  return sh.getRange(2,1,sh.getLastRow()-1,5).getValues().filter(r=>r[0]!=='' && r[2]).map(r=>({
    id:Number(r[0]), student:String(r[1]), name:String(r[2]), target:Number(r[3])||0
  }));
}

function getCategories() {
  const seen={};
  getAssignments_().forEach(a=>{ if(!seen[a.name]) seen[a.name]=a.target; });
  return Object.keys(seen).map(name=>({name,target:seen[name]}));
}

// Cart items: [{studentId: 1 or 'ALL', category:'...', target:100}]
function saveCategoryAssignments(items) {
  if (!Array.isArray(items) || !items.length) throw new Error('Cart is empty.');
  const students=getStudentRows_();
  const sh=ensureStudentCategoriesSheet_();
  const existing=getAssignments_();
  const keys={};
  existing.forEach(a=>keys[a.id+'|'+a.name.toLowerCase()]=true);
  const rows=[];
  items.forEach(item=>{
    const category=String(item.category||'').trim();
    const target=Number(item.target);
    if(!category) throw new Error('Category name is required.');
    if(!isFinite(target)||target<0) throw new Error('Invalid target amount for '+category);
    let selected;
    if(String(item.studentId).toUpperCase()==='ALL') selected=students;
    else selected=students.filter(s=>s.id===Number(item.studentId));
    if(!selected.length) throw new Error('Select a valid student for '+category);
    selected.forEach(s=>{
      const key=s.id+'|'+category.toLowerCase();
      if(!keys[key]) { rows.push([s.id,s.name,category,target,new Date()]); keys[key]=true; }
    });
  });
  if(rows.length) sh.getRange(sh.getLastRow()+1,1,rows.length,5).setValues(rows);
  rows.forEach(function(r){ pushAppNotification_(String(r[0]),'student','New category assigned',r[2]+' category assigned. Target ₹'+r[3]+'.','category'); });
  updateAllStudentBalances_();
  return {success:true,added:rows.length,message:rows.length+' student-category assignment(s) saved.'};
}

// Remove only the selected student's category assignment. Payment history is never touched.
function removeStudentCategory(studentId, categoryName) {
  const id = Number(studentId);
  const category = String(categoryName || '').trim();
  if (!id || !category) throw new Error('Student and category are required.');
  const sh = ensureStudentCategoriesSheet_();
  if (sh.getLastRow() < 2) return {success:true, message:'No category assignment found.'};
  const values = sh.getRange(2,1,sh.getLastRow()-1,5).getValues();
  let removed = 0;
  for (let i = values.length - 1; i >= 0; i--) {
    if (Number(values[i][0]) === id && String(values[i][2] || '').trim().toLowerCase() === category.toLowerCase()) {
      sh.deleteRow(i + 2); removed++;
    }
  }
  updateAllStudentBalances_();
  return {success:true, removed:removed, message: removed ? 'Category removed. Payment history is unchanged.' : 'Assignment not found.'};
}

// Remove one category assignment from every student. Payment history is never deleted.
function removeCategoryFromAllStudents(categoryName) {
  const category = String(categoryName || '').trim();
  if (!category) throw new Error('Select a category to remove.');
  const sh = ensureStudentCategoriesSheet_();
  if (sh.getLastRow() < 2) return {success:true, removed:0, message:'No category assignments found.'};
  const values = sh.getRange(2,1,sh.getLastRow()-1,5).getValues();
  let removed = 0;
  for (let i = values.length - 1; i >= 0; i--) {
    if (String(values[i][2] || '').trim().toLowerCase() === category.toLowerCase()) {
      sh.deleteRow(i + 2);
      removed++;
    }
  }
  updateAllStudentBalances_();
  return {success:true, removed:removed, message: removed + ' assignment(s) of "' + category + '" removed from all students. Payment history is unchanged.'};
}

function updateAllStudentBalances_() {
  const ss=getSS_();
  const studentSheet=ss.getSheetByName('STUDENTS');
  const paymentSheet=ss.getSheetByName('PAYMENTS');
  const students=studentSheet.getDataRange().getValues();
  const payments=paymentSheet.getDataRange().getValues();
  const assignments=getAssignments_();
  const paidByStudent={};
  const targetByStudent={};
  payments.slice(1).forEach(r=>{ const n=String(r[2]||''); paidByStudent[n]=(paidByStudent[n]||0)+(Number(r[4])||0); });
  assignments.forEach(a=>{targetByStudent[a.student]=(targetByStudent[a.student]||0)+a.target;});
  const updates=students.slice(1).map(r=>{
    const name=String(r[1]||''); const paid=paidByStudent[name]||0;
    return [paid,Math.max(0,(targetByStudent[name]||0)-paid)];
  });
  if(updates.length) studentSheet.getRange(2,3,updates.length,2).setValues(updates);
}

function getDashboard() {
  const ss=getSS_();
  const studentSheet=ss.getSheetByName('STUDENTS');
  const paymentSheet=ss.getSheetByName('PAYMENTS');
  const expenseSheet=ss.getSheetByName('EXPENSES');
  const settings=ss.getSheetByName('SETTINGS');
  updateAllStudentBalances_();
  const studentRows=studentSheet.getDataRange().getValues();
  const payments=paymentSheet.getDataRange().getValues();
  const expenses=expenseSheet.getDataRange().getValues();
  const opening=Number(settings.getRange('B2').getValue())||0;
  const paid=payments.slice(1).reduce((s,r)=>s+(Number(r[4])||0),0);
  const spent=expenses.slice(1).reduce((s,r)=>s+(Number(r[3])||0),0);
  const assignments=getAssignments_();
  const students=studentRows.slice(1).map((r,i)=>{
    const id=Number(r[0])||i+1, name=String(r[1]||'');
    const categories=assignments.filter(a=>a.id===id).map(a=>{
      const categoryPaid=payments.slice(1).filter(p=>String(p[2])===name && String(p[3])===a.name).reduce((s,p)=>s+(Number(p[4])||0),0);
      return {name:a.name,target:a.target,paid:categoryPaid,pending:Math.max(0,a.target-categoryPaid)};
    });
    return {id,name,paid:Number(r[2])||0,pending:Number(r[3])||0,categories};
  }).filter(s=>s.name);
  return {opening,collection:paid,expenses:spent,balance:opening+paid-spent,
    pending:students.reduce((s,x)=>s+x.pending,0),students,categories:getCategories(),
    payments:payments.slice(1).map((r,i)=>({rowIndex:i+2,date:r[1],student:r[2],category:r[3],amount:r[4],note:r[5],mode:r[6]||''})).reverse().slice(0,200),
    expenseList:expenses.slice(1).reverse().slice(0,200).map(r=>({date:r[1],description:r[2],amount:r[3],note:r[4]}))};
}

function addPayment(studentId,category,amount,note,mode,upiAmount,cashAmount) {
  amount=Number(amount); const id=Number(studentId);
  mode=String(mode||'UPI');
  upiAmount=Number(upiAmount)||0; cashAmount=Number(cashAmount)||0;
  if(!['UPI','Cash','Both'].includes(mode)) throw new Error('Select a valid payment mode.');
  if(mode==='UPI'){ upiAmount=amount; cashAmount=0; }
  if(mode==='Cash'){ cashAmount=amount; upiAmount=0; }
  if(mode==='Both' && Math.abs((upiAmount+cashAmount)-amount)>0.01) throw new Error('UPI + Cash amount does not match total amount.');
  if(!isFinite(amount)||amount<=0||upiAmount<0||cashAmount<0) throw new Error('Enter valid payment amount.');
  const lock=LockService.getScriptLock(); lock.waitLock(15000);
  try {
    const ss=getSS_(); const students=getStudentRows_();
    const student=students.find(s=>s.id===id);
    if(!student) throw new Error('Student not found.');
    const assignment=getAssignments_().find(a=>a.id===id && a.name===String(category));
    if(!assignment) throw new Error('This category is not assigned to the selected student.');
    const already=ss.getSheetByName('PAYMENTS').getDataRange().getValues().slice(1)
      .filter(r=>String(r[2])===student.name && String(r[3])===String(category))
      .reduce((s,r)=>s+(Number(r[4])||0),0);
    if(already+amount>assignment.target) throw new Error('Payment exceeds this category pending amount.');
    const paymentSheet=ss.getSheetByName('PAYMENTS');
    if(paymentSheet.getLastColumn()<7) paymentSheet.getRange(1,7).setValue('Payment Mode');
    if(paymentSheet.getLastColumn()<8) paymentSheet.getRange(1,8).setValue('UPI Amount');
    if(paymentSheet.getLastColumn()<9) paymentSheet.getRange(1,9).setValue('Cash Amount');
    paymentSheet.appendRow([new Date(),new Date(),student.name,category,amount,note||'',mode,upiAmount,cashAmount]);
    pushAppNotification_('*','admin','Student payment recorded',student.name+' paid ₹'+amount+' for '+category+'.','payment');
    updateAllStudentBalances_(); SpreadsheetApp.flush(); return getDashboard();
  } finally {lock.releaseLock();}
}
// Admin-only correction of an existing payment amount and note. Keeps the original row/date/student/category/mode.
function editPayment(rowIndex, newAmount, newNote){
  const row=Number(rowIndex), amount=Number(newAmount);
  if(!Number.isInteger(row)||row<2) throw new Error('Invalid payment record.');
  if(!isFinite(amount)||amount<=0) throw new Error('Enter a valid payment amount.');
  const lock=LockService.getScriptLock(); lock.waitLock(15000);
  try {
    const sh=getSS_().getSheetByName('PAYMENTS');
    if(!sh||row>sh.getLastRow()) throw new Error('Payment record not found.');
    const vals=sh.getRange(row,1,1,Math.max(9,sh.getLastColumn())).getValues()[0];
    const studentName=String(vals[2]||''), category=String(vals[3]||'');
    const student=getStudentRows_().find(s=>normalizeStudentName_(s.name)===normalizeStudentName_(studentName));
    if(!student) throw new Error('Student record not found.');
    const assignment=getAssignments_().find(a=>a.id===student.id&&a.name===category);
    if(!assignment) throw new Error('Assigned category not found.');
    const all=sh.getDataRange().getValues();
    const paidOther=all.slice(1).reduce((sum,r,i)=>sum+(i+2===row?0:(String(r[2])===studentName&&String(r[3])===category?(Number(r[4])||0):0)),0);
    if(paidOther+amount>assignment.target+0.001) throw new Error('Edited payment exceeds the category target.');
    sh.getRange(row,5).setValue(amount);
    sh.getRange(row,6).setValue(String(newNote||''));
    updateAllStudentBalances_(); SpreadsheetApp.flush();
    return {success:true,message:'Payment updated.',dashboard:getDashboard()};
  } finally { lock.releaseLock(); }
}

// Admin-only removal of an incorrect/duplicate payment record. Recalculates student balances.
function deletePayment(rowIndex){
  // Called only through handlePwaApi_ after its admin-session check.
  const row=Number(rowIndex);
  if(!Number.isInteger(row)||row<2) throw new Error('Invalid payment record. Refresh the dashboard and try again.');
  const lock=LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sh=getSS_().getSheetByName('PAYMENTS');
    if(!sh) throw new Error('PAYMENTS sheet not found.');
    if(row>sh.getLastRow()) throw new Error('Payment record not found. Refresh the dashboard and try again.');
    const record=sh.getRange(row,1,1,Math.max(6,sh.getLastColumn())).getValues()[0];
    const studentName=String(record[2]||'');
    const category=String(record[3]||'');
    const amount=Number(record[4])||0;
    if(!studentName||!category||amount<=0) throw new Error('Payment record is empty or invalid.');
    sh.deleteRow(row);
    updateAllStudentBalances_();
    SpreadsheetApp.flush();
    return {success:true,message:'Payment removed successfully. Student paid and pending totals have been recalculated.',removed:{student:studentName,category:category,amount:amount}};
  } finally {
    lock.releaseLock();
  }
}

// Manual UPI proof workflow. Existing PAYMENT rows are written only after admin approval.
function ensureUpiSubmissionsSheet_(){
  const ss=getSS_(); let sh=ss.getSheetByName('UPI SUBMISSIONS');
  if(!sh){ sh=ss.insertSheet('UPI SUBMISSIONS'); sh.getRange(1,1,1,11).setValues([['Submission ID','Submitted At','Student Name','Student AR ID','Category','Amount','UTR / Transaction ID','Note','Status','Reviewed At','Admin Note']]); sh.setFrozenRows(1); }
  return sh;
}
function submitUpiPayment_(session, category, amount, utr, note){
  if(session.role!=='student') throw new Error('Only student accounts can submit UPI proof.');
  category=String(category||'').trim(); amount=Number(amount); utr=String(utr||'').trim(); note=String(note||'').trim();
  if(!category) throw new Error('Select a category.');
  if(!isFinite(amount)||amount<=0) throw new Error('Enter a valid amount.');
  if(utr.length<8 || utr.length>40 || !/^[A-Za-z0-9-]+$/.test(utr)) throw new Error('Enter a valid UTR / transaction ID (8–40 letters or numbers).');
  const dash=getDashboardForSession_(session); const student=dash.students[0];
  if(!student) throw new Error('Student record not found.');
  const assignment=(student.categories||[]).find(c=>c.name===category);
  if(!assignment) throw new Error('This category is not assigned to you.');
  if(amount>Number(assignment.pending||0)+0.001) throw new Error('Amount exceeds the current pending amount. Refresh and try again.');
  const sh=ensureUpiSubmissionsSheet_();
  const rows=sh.getLastRow()>1?sh.getRange(2,1,sh.getLastRow()-1,11).getValues():[];
  if(rows.some(r=>String(r[6]).toLowerCase()===utr.toLowerCase() && String(r[8]).toUpperCase()!=='REJECTED')) throw new Error('This transaction ID has already been submitted.');
  const id=Utilities.getUuid();
  sh.appendRow([id,new Date(),student.name,session.username,category,amount,utr,note,'PENDING','','']);
  pushAppNotification_('*','admin','UPI payment proof submitted',student.name+' submitted ₹'+amount+' for '+category+'.','upi');
  return {ok:true,message:'Payment proof submitted. It will be marked Paid after admin verification.'};
}
function listPendingUpiPayments(){
  const sh=ensureUpiSubmissionsSheet_(); if(sh.getLastRow()<2)return [];
  return sh.getRange(2,1,sh.getLastRow()-1,11).getValues().filter(r=>String(r[8]).toUpperCase()==='PENDING').map(r=>({id:String(r[0]),submittedAt:r[1],student:r[2],arid:r[3],category:r[4],amount:Number(r[5]),utr:r[6],note:r[7]})).reverse();
}
function approveUpiPayment(id, adminNote){
  id=String(id||'');
  {
    const sh=ensureUpiSubmissionsSheet_(); const rows=sh.getLastRow()>1?sh.getRange(2,1,sh.getLastRow()-1,11).getValues():[];
    const idx=rows.findIndex(r=>String(r[0])===id); if(idx<0)throw new Error('Submission not found.');
    const r=rows[idx]; if(String(r[8]).toUpperCase()!=='PENDING')throw new Error('This submission has already been reviewed.');
    // Claim the request before writing the payment, preventing double approval clicks.
    sh.getRange(idx+2,9).setValue('PROCESSING');
    try {
      const studentRows=getDashboard().students; const student=studentRows.find(x=>normalizeStudentName_(x.name)===normalizeStudentName_(r[2]));
      if(!student)throw new Error('Student record not found.');
      addPayment(student.id,String(r[4]),Number(r[5]),'UTR: '+String(r[6])+(r[7]?' | '+r[7]:''),'UPI',Number(r[5]),0);
      sh.getRange(idx+2,9,1,3).setValues([['APPROVED',new Date(),String(adminNote||'Approved by admin')]]);
      pushAppNotification_(String(r[3]),'student','Payment approved','Your ₹'+r[5]+' payment for '+r[4]+' has been approved.','approved');
      return {ok:true,message:'Approved and recorded as Paid.'};
    } catch(err) { sh.getRange(idx+2,9).setValue('PENDING'); throw err; }
  }
}
function rejectUpiPayment(id, adminNote){
  const sh=ensureUpiSubmissionsSheet_(); const rows=sh.getLastRow()>1?sh.getRange(2,1,sh.getLastRow()-1,11).getValues():[];
  const idx=rows.findIndex(r=>String(r[0])===String(id)); if(idx<0)throw new Error('Submission not found.');
  if(String(rows[idx][8]).toUpperCase()!=='PENDING')throw new Error('This submission has already been reviewed.');
  sh.getRange(idx+2,9,1,3).setValues([['REJECTED',new Date(),String(adminNote||'Rejected by admin')]]);
  pushAppNotification_(String(rows[idx][3]),'student','Payment rejected','Your payment proof for '+rows[idx][4]+' was rejected. '+String(adminNote||''),'rejected');
  return {ok:true,message:'Submission rejected.'};
}

function updateOpeningBalance(amount,note) {
  amount=Number(amount); if(!isFinite(amount)||amount<0) throw new Error('Enter valid opening balance.');
  const ss=getSS_(), sh=ss.getSheetByName('SETTINGS'), log=ss.getSheetByName('BALANCE HISTORY');
  const old=Number(sh.getRange('B2').getValue())||0; sh.getRange('B2').setValue(amount);
  if(log) log.appendRow([new Date(),old,amount,note||'Opening balance updated']);
  return getDashboard();
}

function addExpense(description,amount,note) {
  description=String(description||'').trim(); amount=Number(amount);
  if(!description||!isFinite(amount)||amount<=0) throw new Error('Enter valid expense details.');
  getSS_().getSheetByName('EXPENSES').appendRow([new Date(),new Date(),description,amount,note||'']);
  pushAppNotification_('*','admin','New expense added',description+' — ₹'+amount+'.','expense');
  return getDashboard();
}

function refreshDashboard() { return getDashboard(); }
function setupAppPassword(password) {
  password = String(password || '');
  if (password.length < 8) throw new Error('Use a password with at least 8 characters.');
  const hash=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,password)
    .map(b=>(b+256).toString(16).slice(-2)).join('');
  PropertiesService.getScriptProperties().setProperty('APP_PASSWORD_HASH',hash);
  return 'Password saved successfully';
}
function checkLogin(password) {
  const email=(Session.getActiveUser().getEmail()||'').toLowerCase().trim();
  if(email===AUTHORIZED_EMAIL.toLowerCase()) return true;
  const saved=PropertiesService.getScriptProperties().getProperty('APP_PASSWORD_HASH');
  if(!saved) throw new Error('Admin password not configured. Run setupAppPassword(password) once.');
  const hash=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(password||'')).map(b=>(b+256).toString(16).slice(-2)).join('');
  return hash===saved;
}

// AR IDs supplied for the 55 student accounts. Existing spreadsheet names are matched safely.
const STUDENT_LOGIN_MAP_ = [
 ['AR1679','ARUN A'],['AR1687','AYISHA NALAKATH'],['AR1658','AYISHA RIDHA E'],['AR1678','DIVANI PP'],['AR1685','FAHIM M FAISAL'],['AR1652','FARSEENA V'],['AR1681','FATHIMA BAYAN'],['AR1677','FATHIMA HAIZA CMK'],['AR1649','FATHIMA HAMDAH P'],['AR1668','FATHIMA HIBA PE'],['AR1643','FATHIMA NASRIN K'],['AR1665','FATHIMA NIDHA K P'],['AR1655','FATHIMA RASHFIN TA'],['AR1647','FATHIMA RENA KC'],['AR1691','FATHIMA RIZA TE'],['AR1669','FATHIMATHUL ASNA M'],['AR1660','HIBA SHARIN KT'],['AR1689','JAZL AHMAD PM'],['AR1663','KADEEJA JOUNA C'],['AR1661','LIYA EP'],['AR1688','LIYA MEHJABIN'],['AR1644','MEERA U'],['AR1653','MINHA K'],['AR1659','MUHAMMED ARSHAK K'],['AR1672','MOHAMMED BASITH'],['AR1662','MUHAMMED ADEEB VM'],['AR1650','MUHAMMED ASIF PARI'],['AR1673','MUHAMMED LIYAN P'],['AR1654','MUHAMMED NAVEDUL ANJOOM AT'],['AR1670','MUHAMMED RAYAN M'],['AR1680','MUHAMMED SHAN K'],['AR1657','NADHA MEHJABIN V'],['AR1676','NAFIDA VP'],['AR1675','NAJA FATHIMA'],['AR1640','NAJMA V'],['AR1674','NAMITHA M'],['AR1656','NASHVA PV'],['AR1683','RENA MEHRIN AM'],['AR1684','RIMA FATHIMA'],['AR1671','RINSHA SHANAVAS'],['AR1686','RIYA FIBIN P'],['AR1646','SANA N'],['AR1664','SHAFRIN RAHMAN ALYATHODI'],['AR1641','SHAHEEM NADUTHODI'],['AR1651','SHAIMA SHIREEN K'],['AR1642','SHEBA IQBAL'],['AR1682','SHEMIL MUHAMMED'],['AR1648','SHINA FATHIMA CK'],['AR1700','FATHIMA JUNNA K.K'],['AR1699','FATHIMA SHAHNA M'],['AR1704','JYOTSNA RAJ'],['AR1702','RAHMA K.'],['AR1701','SANA K.'],['AR1703','SHAHDHA A.K'],['AR1705','ZENHA FATHIMA']
];
function normalizeStudentName_(s){return String(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'');}
// Student passwords use HMAC-SHA256 with a random per-password salt and a
// server-side pepper stored only in Script Properties. Legacy hashes are
// verified on login and upgraded automatically.
function ensureStudentPasswordPepper_(){
  const props=PropertiesService.getScriptProperties();
  let pepper=props.getProperty('STUDENT_PASSWORD_PEPPER');
  if(!pepper){
    pepper=Utilities.getUuid()+Utilities.getUuid()+Utilities.getUuid();
    props.setProperty('STUDENT_PASSWORD_PEPPER',pepper);
  }
  return pepper;
}
function legacyPasswordHash_(username,password){
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(username).toUpperCase()+'|'+String(password))
    .map(b=>(b+256).toString(16).slice(-2)).join('');
}
function passwordHash_(username,password){
  const salt=Utilities.getUuid().replace(/-/g,'');
  const message=String(username).trim().toUpperCase()+'|'+salt+'|'+String(password);
  const bytes=Utilities.computeHmacSha256Signature(message,ensureStudentPasswordPepper_());
  const hex=bytes.map(b=>(b+256).toString(16).slice(-2)).join('');
  return 'v2$'+salt+'$'+hex;
}
function secureHashCompare_(a,b){
  a=String(a);b=String(b);if(a.length!==b.length)return false;
  let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);
  return diff===0;
}
function verifyPassword_(username,password,stored){
  stored=String(stored||'');
  if(stored.indexOf('v2$')===0){
    const parts=stored.split('$');if(parts.length!==3)return false;
    const message=String(username).trim().toUpperCase()+'|'+parts[1]+'|'+String(password);
    const bytes=Utilities.computeHmacSha256Signature(message,ensureStudentPasswordPepper_());
    const hex=bytes.map(b=>(b+256).toString(16).slice(-2)).join('');
    return secureHashCompare_(hex,parts[2]);
  }
  return secureHashCompare_(legacyPasswordHash_(username,password),stored);
}
function randomTempPassword_(){return Utilities.getUuid().replace(/-/g,'').slice(0,4)+'@'+Utilities.getUuid().replace(/-/g,'').slice(0,4)+'!';}
function ensureLoginSheet_(){
  const ss=getSS_(); let sh=ss.getSheetByName('LOGIN_ACCOUNTS');
  if(!sh){sh=ss.insertSheet('LOGIN_ACCOUNTS');sh.getRange(1,1,1,6).setValues([['AR ID','Student Name','Password Hash','Active','Created At','Updated At']]);sh.setFrozenRows(1);}
  return sh;
}
function loginAccount_(username,password){
  username=String(username||'').trim().toUpperCase();
  // Backward-compatible admin alias: the login screen previously displayed "admin",
  // while the server's primary admin account is ASIF.
  if(username==='ADMIN') username='ASIF';
  if(!username||!password)return null;
  if(username==='ASIF' && checkLogin(password)) return {role:'admin',username:'ASIF',name:'Administrator'};
  // Faculty accounts are stored separately from student login records.
  var facultySh=ensureFacultySheet_();
  if(facultySh.getLastRow()>1){
    var facultyRows=facultySh.getRange(2,1,facultySh.getLastRow()-1,8).getValues();
    var facultyRow=facultyRows.find(function(r){return String(r[0]).toUpperCase()===username;});
    if(facultyRow && String(facultyRow[6]).toUpperCase()==='TRUE' && verifyPassword_(username,password,String(facultyRow[5]||'')))
      return {role:'faculty',username:username,name:String(facultyRow[1]),mustChangePassword:false};
  }
  const sh=ensureLoginSheet_(); if(sh.getLastRow()<2)return null;
  const rows=sh.getRange(2,1,sh.getLastRow()-1,6).getValues();
  const row=rows.find(r=>String(r[0]).toUpperCase()===username);
  if(!row || String(row[3]).toUpperCase()!=='TRUE')return null;
  const storedHash=String(row[2]||'');
  if(!verifyPassword_(username,password,storedHash))return null;
  // Upgrade a valid legacy hash after successful authentication.
  if(storedHash.indexOf('v2$')!==0){
    const rowIndex=rows.findIndex(r=>String(r[0]).toUpperCase()===username)+2;
    sh.getRange(rowIndex,3).setValue(passwordHash_(username,password));
    sh.getRange(rowIndex,6).setValue(new Date());
  }
  return {role:getAccountRole_(username),username:username,name:String(row[1]),studentName:String(row[1]),mustChangePassword:studentMustChangePassword_(username)};
}
// Student account role conversion. Student login, password, payment history and profile remain in place.
function ensureAccountRolesSheet_(){
  var ss=getSS_(), sh=ss.getSheetByName('ACCOUNT_ROLES');
  if(!sh){sh=ss.insertSheet('ACCOUNT_ROLES');sh.getRange(1,1,1,5).setValues([['Username','Role','Updated At','Updated By','Account Name']]);sh.setFrozenRows(1);}
  return sh;
}
function getAccountRole_(username){
  var id=String(username||'').trim().toUpperCase();
  if(isPrimaryAdmin_(id)||isDelegatedAdmin_(id)) return 'admin';
  if(isFacultyLogin_(id)) return 'faculty';
  var sh=ensureAccountRolesSheet_();
  if(sh.getLastRow()>1){var rows=sh.getRange(2,1,sh.getLastRow()-1,2).getValues();for(var i=0;i<rows.length;i++)if(String(rows[i][0]).toUpperCase()===id)return String(rows[i][1]||'student').toLowerCase();}
  return 'student';
}
function listRoleAccounts_(session){
  if(session.role!=='admin')throw new Error('Admin access required.');
  var login=ensureLoginSheet_(), rows=login.getLastRow()>1?login.getRange(2,1,login.getLastRow()-1,6).getValues():[];
  return rows.map(function(r){return {username:String(r[0]),name:String(r[1]),active:String(r[3]).toUpperCase()==='TRUE',role:getAccountRole_(r[0])};});
}
function setStudentRole_(session,username,role){
  if(session.role!=='admin')throw new Error('Admin access required.');
  var id=String(username||'').trim().toUpperCase(), next=String(role||'').trim().toLowerCase();
  if(['admin','studio_head','class_rep','student'].indexOf(next)<0)throw new Error('Invalid role.');
  if(id==='ASIF')throw new Error('Primary admin role cannot be changed.');
  var login=ensureLoginSheet_(), rows=login.getLastRow()>1?login.getRange(2,1,login.getLastRow()-1,6).getValues():[];
  var row=null; for(var i=0;i<rows.length;i++)if(String(rows[i][0]).toUpperCase()===id){row=rows[i];break;}
  if(!row)throw new Error('Student login account not found. Create the student login first.');
  if(String(row[3]).toUpperCase()!=='TRUE')throw new Error('Enable this student account before changing its role.');
  if(next==='admin'&&!isPrimaryAdmin_(session.username))throw new Error('Only the primary admin can grant Admin Access.');
  // Keep legacy delegated-admin table synchronized for compatibility with older app code.
  if(next==='admin'){
    var admins=ensureAdminUsersSheet_();
    if(!isDelegatedAdmin_(id))admins.appendRow([id,String(row[1]),new Date(),session.username]);
  } else {
    var admins=ensureAdminUsersSheet_();
    if(admins.getLastRow()>1){var av=admins.getRange(2,1,admins.getLastRow()-1,4).getValues();for(var j=av.length-1;j>=0;j--)if(String(av[j][0]).toUpperCase()===id)admins.deleteRow(j+2);}
  }
  var sh=ensureAccountRolesSheet_(), last=sh.getLastRow(), found=0;
  if(last>1){var rv=sh.getRange(2,1,last-1,5).getValues();for(var k=0;k<rv.length;k++)if(String(rv[k][0]).toUpperCase()===id){found=k+2;break;}}
  var values=[id,next,new Date(),session.username,String(row[1])];
  if(found)sh.getRange(found,1,1,5).setValues([values]);else sh.appendRow(values);
  return {success:true,username:id,name:String(row[1]),role:next,message:String(row[1])+' role changed to '+next+'.'};
}

// Delegated administrator access is stored separately; existing account and payment data remain untouched.
function ensureAdminUsersSheet_(){
  const ss=getSS_(); let sh=ss.getSheetByName('ADMIN_USERS');
  if(!sh){ sh=ss.insertSheet('ADMIN_USERS'); sh.getRange(1,1,1,4).setValues([['AR ID','Student Name','Granted At','Granted By']]); sh.setFrozenRows(1); }
  return sh;
}
function isPrimaryAdmin_(username){ return String(username||'').toUpperCase()==='ASIF'; }
function isDelegatedAdmin_(username){
  const id=String(username||'').trim().toUpperCase(); if(!id || isPrimaryAdmin_(id)) return false;
  const sh=ensureAdminUsersSheet_(); if(sh.getLastRow()<2) return false;
  return sh.getRange(2,1,sh.getLastRow()-1,1).getValues().some(r=>String(r[0]||'').toUpperCase()===id);
}
function grantAdminAccess(arId){
  arId=String(arId||'').trim().toUpperCase();
  if(!STUDENT_LOGIN_MAP_.some(x=>x[0]===arId)) throw new Error('Unknown student AR ID.');
  const account=ensureLoginSheet_().getDataRange().getValues().find((r,i)=>i>0&&String(r[0]).toUpperCase()===arId);
  if(!account || String(account[3]).toUpperCase()!=='TRUE') throw new Error('Create and enable this student login first.');
  const sh=ensureAdminUsersSheet_();
  if(isDelegatedAdmin_(arId)) return {success:true,message:'This student already has Admin Access.'};
  sh.appendRow([arId,String(account[1]),new Date(),'ASIF']);
  return {success:true,message:arId+' — Admin Access granted.'};
}
function revokeAdminAccess(arId){
  arId=String(arId||'').trim().toUpperCase();
  if(!arId || isPrimaryAdmin_(arId)) throw new Error('Primary admin access cannot be revoked here.');
  const sh=ensureAdminUsersSheet_();
  if(sh.getLastRow()<2) return {success:true,message:'No delegated admins found.'};
  const vals=sh.getRange(2,1,sh.getLastRow()-1,4).getValues();
  for(let i=vals.length-1;i>=0;i--){ if(String(vals[i][0]).toUpperCase()===arId) sh.deleteRow(i+2); }
  return {success:true,message:arId+' — Admin Access revoked.'};
}
function listAdminUsers(){
  const sh=ensureAdminUsersSheet_(); if(sh.getLastRow()<2) return [];
  return sh.getRange(2,1,sh.getLastRow()-1,4).getValues().map(r=>({username:String(r[0]),name:String(r[1]),grantedAt:r[2]}));
}

function getDashboardForSession_(session){
  const d=getDashboard();
  if(session.role==='admin'){d.role='admin';d.currentUser=session.name;return d;}
  if(session.role==='faculty'){return {role:'faculty',currentUser:session.name,opening:0,collection:0,expenses:0,balance:0,pending:0,students:[],categories:[],payments:[],expenseList:[]};}
  const name=String(session.studentName||session.name||'');
  const me=(d.students||[]).find(s=>normalizeStudentName_(s.name)===normalizeStudentName_(name));
  if(!me)throw new Error('Your student record was not found. Contact the admin.');
  return {
    role:session.role,currentUser:me.name,opening:0,collection:me.paid,expenses:d.expenses,balance:0,pending:me.pending,
    students:[me],categories:me.categories||[],
    payments:(d.payments||[]).filter(p=>normalizeStudentName_(p.student)===normalizeStudentName_(me.name)),
    expenseList:d.expenseList||[]
  };
}
// Run once from Apps Script editor. Creates 55 accounts with unique temporary passwords.
// Copy the returned credentials and share each password privately with its student.
function initializeStudentAccounts(){
  const sh=ensureLoginSheet_();
  const existing={}; if(sh.getLastRow()>1)sh.getRange(2,1,sh.getLastRow()-1,6).getValues().forEach((r,i)=>existing[String(r[0]).toUpperCase()]={row:i+2,data:r});
  const students=getStudentRows_(); const byName={}; students.forEach(s=>byName[normalizeStudentName_(s.name)]=s);
  const created=[]; const missing=[];
  STUDENT_LOGIN_MAP_.forEach(pair=>{
    const arid=pair[0], expected=pair[1], student=byName[normalizeStudentName_(expected)];
    if(!student){missing.push({username:arid,expectedName:expected});return;}
    if(existing[arid])return;
    const temp=randomTempPassword_();
    sh.appendRow([arid,student.name,passwordHash_(arid,temp),true,new Date(),new Date()]);
    sh.getRange(sh.getLastRow(),7).setValue(true);
     created.push({username:arid,name:student.name,temporaryPassword:temp});
  });
  return {created:created,alreadyExisting:Object.keys(existing),missing:missing,note:'Save these temporary passwords now. They are not stored in readable form.'};
}
function createStudentAccount(arId){
  arId=String(arId||'').trim().toUpperCase();
  const pair=STUDENT_LOGIN_MAP_.find(x=>x[0]===arId); if(!pair)throw new Error('Unknown AR ID.');
  const student=getStudentRows_().find(s=>normalizeStudentName_(s.name)===normalizeStudentName_(pair[1]));
  if(!student)throw new Error('Student record not found in STUDENTS sheet.');
  const sh=ensureLoginSheet_(); const values=sh.getDataRange().getValues();
  const found=values.findIndex((r,i)=>i>0&&String(r[0]).toUpperCase()===arId);
  const temp=randomTempPassword_(), row=[arId,student.name,passwordHash_(arId,temp),true,new Date(),new Date()];
  if(found>0) { sh.getRange(found+1,1,1,6).setValues([row]); sh.getRange(found+1,7).setValue(true); }
   else { sh.appendRow(row); sh.getRange(sh.getLastRow(),7).setValue(true); }
  return {username:arId,name:student.name,temporaryPassword:temp};
}
function setStudentAccountActive(arId,active){
  const sh=ensureLoginSheet_(), rows=sh.getDataRange().getValues();
  const i=rows.findIndex((r,n)=>n>0&&String(r[0]).toUpperCase()===String(arId).toUpperCase());
  if(i<1)throw new Error('Account not found.');
  sh.getRange(i+1,4).setValue(!!active);sh.getRange(i+1,6).setValue(new Date());
  return {success:true,username:String(arId).toUpperCase(),active:!!active};
}
function listStudentAccounts(){
  const sh=ensureLoginSheet_(); if(sh.getLastRow()<2)return [];
  return sh.getRange(2,1,sh.getLastRow()-1,6).getValues().map(r=>({username:r[0],name:r[1],active:String(r[3]).toUpperCase()==='TRUE'}));
}

// Run this function ONCE to set the Admin password.
// After successful execution, remove this helper for security.
function setMyAdminPasswordOnce() {
  setupAppPassword('asif@123');
}

// TEMPORARY STUDENT PASSWORD RESET:
// Sets each student's initial password equal to their AR ID.
// Example: username AR1679, password AR1679.
// Run once, then remove this helper function and save.
function setAllStudentPasswordsToUsername() {
  const sh = ensureLoginSheet_();
  if (sh.getLastRow() < 2) {
    throw new Error('No student accounts found. Run initializeStudentAccounts() first.');
  }

  const rows = sh.getRange(2, 1, sh.getLastRow() - 1, 6).getValues();
  let updated = 0;

  rows.forEach((row, index) => {
    const arId = String(row[0] || '').trim().toUpperCase();
    if (!arId) return;

    sh.getRange(index + 2, 3).setValue(passwordHash_(arId, arId));
    sh.getRange(index + 2, 7).setValue(true);
    sh.getRange(index + 2, 6).setValue(new Date());
    updated++;
  });

  return updated + ' student account password(s) set to their AR ID.';
}

// Column G marks temporary passwords that must be changed.
function studentMustChangePassword_(arId) {
  const sh = ensureLoginSheet_();
  if (sh.getLastColumn() < 7 || sh.getLastRow() < 2) return false;
  const rows = sh.getRange(2, 1, sh.getLastRow()-1, 7).getValues();
  const row = rows.find(r => String(r[0]).toUpperCase() === String(arId).toUpperCase());
  if (!row) return false;
  // Also recognize initial AR-ID passwords set before this upgrade.
  return row[6] === true || String(row[6]).toUpperCase() === 'TRUE' ||
    verifyPassword_(arId, arId, String(row[2]||''));
}

function changeMyPassword_(session, oldPassword, newPassword) {
  if (['student','studio_head','class_rep'].indexOf(session.role) < 0) throw new Error('Student account login required.');
  if (newPassword.length < 8) throw new Error('New password must contain at least 8 characters.');
  if (newPassword === oldPassword || newPassword.toUpperCase() === session.username.toUpperCase())
    throw new Error('Choose a new password different from your AR ID and temporary password.');
  const sh = ensureLoginSheet_();
  const rows = sh.getRange(2, 1, sh.getLastRow()-1, 6).getValues();
  const i = rows.findIndex(r => String(r[0]).toUpperCase() === session.username.toUpperCase());
  if (i < 0 || String(rows[i][3]).toUpperCase() !== 'TRUE') throw new Error('Account unavailable.');
  if (!verifyPassword_(session.username, oldPassword, String(rows[i][2]||'')))
    throw new Error('Current password is incorrect.');
  sh.getRange(i+2, 3).setValue(passwordHash_(session.username, newPassword));
  sh.getRange(i+2, 7).setValue(false);
  sh.getRange(i+2, 6).setValue(new Date());
  return {success:true, message:'Password updated. Please log in with your new password.'};
}

// ---------------- ARMAADHA CLASS TIMETABLE ----------------
function ensureTimetableSheet_(){
  var ss=getSS_(), sh=ss.getSheetByName('TIMETABLE');
  var headers=['Entry ID','Day','Start Time','End Time','Subject','Faculty ID','Faculty Name','Room / Studio','Notes','Updated At','Updated By'];
  if(!sh){
    sh=ss.insertSheet('TIMETABLE');
    sh.getRange(1,1,1,headers.length).setValues([headers]);
    sh.setFrozenRows(1);
  } else if(sh.getLastRow()<1 || !String(sh.getRange(1,1).getValue()||'')) {
    sh.getRange(1,1,1,headers.length).setValues([headers]);
    sh.setFrozenRows(1);
  } else if(sh.getLastColumn()<headers.length) {
    sh.insertColumnsAfter(Math.max(1,sh.getLastColumn()),headers.length-sh.getLastColumn());
    sh.getRange(1,1,1,headers.length).setValues([headers]);
  }
  return sh;
}
function normalizeTimetableFacultyName_(value){
  return String(value||'').toLowerCase().replace(/^\s*(?:ar|er)\.?\s*/,'').replace(/[^a-z0-9]/g,'');
}
function timetableFacultyNameMatches_(entryNames,accountName){
  var target=normalizeTimetableFacultyName_(accountName);if(!target)return false;
  return String(entryNames||'').split(/[;,]/).some(function(name){return normalizeTimetableFacultyName_(name)===target;});
}
function seedSemester3Timetable_(){
  var props=PropertiesService.getScriptProperties(),flag='ARMAADHA_TIMETABLE_SEM3_SEEDED_V1';
  if(props.getProperty(flag)==='1')return;
  var sh=ensureTimetableSheet_();
  if(sh.getLastRow()>1){props.setProperty(flag,'1');return;}
  var entries=[
    ['Monday','09:15','10:45','AR 22-34 – Theory of Structures - II','Er.Fidha Sherin','Classroom AB2 401',''],
    ['Monday','11:00','12:30','AR 22-35 – History of Architecture - II','Ar. Jasin M','Classroom AB2 401',''],
    ['Monday','13:15','14:45','AR 22-36 – Building Services - I (Water Supply & Sanitation)','Ar. Fathima Rishin','Studio AB2 401',''],
    ['Monday','14:45','16:15','AR 22-33 – Building Materials & Construction - II','Ar. Safa Shahjahan','Studio AB2 401',''],
    ['Tuesday','09:15','10:45','AR 22-31 – Architectural Design-I','Ar. Akhil P, Ar.Shamri NP, Ar. Musthaq Mahamood M, Ar. Ahammed Shakir','Classroom AB2 401',''],
    ['Tuesday','11:00','12:30','AR 22-31 – Architectural Design-I','Ar. Akhil P, Ar.Shamri NP, Ar. Musthaq Mahamood M, Ar. Ahammed Shakir','Classroom AB2 401',''],
    ['Tuesday','13:15','16:15','AR 22-31 – Architectural Design-I','Ar. Akhil P, Ar.Shamri NP, Ar. Musthaq Mahamood M, Ar. Ahammed Shakir','Studio AB2 401',''],
    ['Wednesday','09:15','10:45','AR 22-36 – Building Services - I (Water Supply & Sanitation)','Ar. Fathima Rishin','Classroom AB2 401',''],
    ['Wednesday','11:00','12:30','AR 22-34 – Theory of Structures - II','Er.Fidha Sherin','Classroom AB2 401',''],
    ['Wednesday','13:15','16:15','AR 22-31 – Architectural Design-I','Ar. Akhil P, Ar.Shamri NP, Ar. Musthaq Mahamood M, Ar. Ahammed Shakir','Studio AB2 401',''],
    ['Thursday','09:15','10:45','AR 22-35 – History of Architecture - II','Ar. Jasin M','Classroom AB2 401',''],
    ['Thursday','11:00','12:30','AR 22-33 – Building Materials & Construction - II','Ar. Safa Shahjahan','Classroom AB2 401',''],
    ['Thursday','13:15','14:45','AR 22-31 – Architectural Design-I','Ar. Akhil P, Ar.Shamri NP, Ar. Musthaq Mahamood M, Ar. Ahammed Shakir','Studio AB2 401',''],
    ['Thursday','14:45','16:15','SSA Activities','Ar. Akhil P, Ar.Shamri NP, Ar. Musthaq Mahamood M, Ar. Ahammed Shakir','Studio AB2 401',''],
    ['Friday','09:15','10:45','AR 22-32 – Building Climatology','Ar. Merlin P Joseph','Classroom AB2 401',''],
    ['Friday','11:00','12:30','AR 22-32 – Building Climatology','Ar. Merlin P Joseph','Classroom AB2 401',''],
    ['Friday','13:15','14:00','Prayer','—','Studio AB2 401',''],
    ['Friday','14:00','16:15','AR 22-37 – Computer Aided Visualization - I','Ar. Muhammed Sayyaf AC','Studio AB2 401','']
  ];
  var now=new Date();
  var values=entries.map(function(e){return [Utilities.getUuid(),e[0],e[1],e[2],e[3],'',e[4],e[5],e[6],now,'SYSTEM_SEMESTER_3_IMPORT'];});
  sh.getRange(2,1,values.length,11).setValues(values);
  props.setProperty(flag,'1');
}
function listTimetable_(session){
  var sh=ensureTimetableSheet_();
  seedSemester3Timetable_();
  if(sh.getLastRow()<2)return [];
  var rows=sh.getRange(2,1,sh.getLastRow()-1,11).getValues();
  var isFaculty=session.role==='faculty';
  return rows.filter(function(r){
    if(!r[0])return false;
    if(isFaculty){
      var idMatch=String(r[5]||'').trim().toUpperCase()===String(session.username||'').trim().toUpperCase();
      return idMatch||timetableFacultyNameMatches_(r[6],session.name);
    }
    return true;
  }).map(function(r){return {
    id:String(r[0]),day:String(r[1]),startTime:String(r[2]),endTime:String(r[3]),subject:String(r[4]),
    facultyId:String(r[5]),facultyName:String(r[6]),room:String(r[7]),notes:String(r[8])
  };});
}
function saveTimetableEntry_(session,data){
  if(session.role!=='admin')throw new Error('Only Admin can manage the timetable.');
  data=data||{};
  var day=String(data.day||'').trim();
  var allowed=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  var start=String(data.startTime||'').trim(), end=String(data.endTime||'').trim();
  var subject=String(data.subject||'').trim(), facultyId=String(data.facultyId||'').trim().toUpperCase();
  var facultyName=String(data.facultyName||'').trim();
  if(allowed.indexOf(day)<0)throw new Error('Select a valid day.');
  if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(start)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(end)||end<=start)throw new Error('Enter a valid start time and an end time later than the start time.');
  if(!subject||!facultyName)throw new Error('Subject and Faculty Name are required.');
  if(subject.length>120||facultyName.length>120||facultyId.length>30||String(data.room||'').length>80||String(data.notes||'').length>500)throw new Error('One or more timetable fields are too long.');
  var lock=LockService.getScriptLock();lock.waitLock(15000);
  try{
    var sh=ensureTimetableSheet_(), id=String(data.id||Utilities.getUuid()), row=0;
    if(sh.getLastRow()>1){var ids=sh.getRange(2,1,sh.getLastRow()-1,1).getValues();for(var i=0;i<ids.length;i++)if(String(ids[i][0])===id){row=i+2;break;}}
    var values=[id,day,start,end,subject,facultyId,facultyName,String(data.room||'').trim(),String(data.notes||'').trim(),new Date(),String(session.username||'')];
    if(row)sh.getRange(row,1,1,11).setValues([values]);else sh.appendRow(values);
    return {ok:true,id:id,message:row?'Timetable entry updated.':'Timetable entry added.'};
  }finally{lock.releaseLock();}
}
function deleteTimetableEntry_(session,id){
  if(session.role!=='admin')throw new Error('Only Admin can manage the timetable.');
  id=String(id||'');if(!id)throw new Error('Timetable entry ID is required.');
  var lock=LockService.getScriptLock();lock.waitLock(15000);
  try{
    var sh=ensureTimetableSheet_();if(sh.getLastRow()<2)throw new Error('Timetable entry not found.');
    var ids=sh.getRange(2,1,sh.getLastRow()-1,1).getValues();
    for(var i=ids.length-1;i>=0;i--)if(String(ids[i][0])===id){sh.deleteRow(i+2);return {ok:true,message:'Timetable entry deleted.'};}
    throw new Error('Timetable entry not found.');
  }finally{lock.releaseLock();}
}

// ---------------- FACULTY LOGIN + WORK SUBMISSION ----------------
function ensureFacultySheet_(){
  var sh=getSS_().getSheetByName('FACULTY_ACCOUNTS');
  if(!sh){sh=getSS_().insertSheet('FACULTY_ACCOUNTS');sh.getRange(1,1,1,8).setValues([['Faculty ID','Faculty Name','Department','Email','Phone','Password Hash','Active','Created At']]);sh.setFrozenRows(1);}
  return sh;
}
function isFacultyLogin_(id){
  id=String(id||'').trim().toUpperCase(); if(!id)return false;
  var sh=ensureFacultySheet_(); if(sh.getLastRow()<2)return false;
  return sh.getRange(2,1,sh.getLastRow()-1,7).getValues().some(function(r){return String(r[0]).toUpperCase()===id&&String(r[6]).toUpperCase()==='TRUE';});
}
function listFaculty_(session){
  if(session.role!=='admin')throw new Error('Admin access required.');
  var sh=ensureFacultySheet_(); if(sh.getLastRow()<2)return [];
  return sh.getRange(2,1,sh.getLastRow()-1,8).getValues().map(function(r){return {id:String(r[0]),name:String(r[1]),department:String(r[2]),email:String(r[3]),phone:String(r[4]),active:String(r[6]).toUpperCase()==='TRUE'};});
}
function createFacultyAccount_(session,data){
  if(session.role!=='admin')throw new Error('Admin access required.');
  data=data||{}; var id=String(data.id||'').trim().toUpperCase(), name=String(data.name||'').trim();
  if(!/^[A-Z0-9_-]{3,30}$/.test(id)||!name)throw new Error('Enter a valid Faculty ID and name.');
  var sh=ensureFacultySheet_(), rows=sh.getLastRow()>1?sh.getRange(2,1,sh.getLastRow()-1,1).getValues():[];
  if(rows.some(function(r){return String(r[0]).toUpperCase()===id;}))throw new Error('Faculty ID already exists.');
  var temp=randomTempPassword_(); sh.appendRow([id,name,String(data.department||''),String(data.email||''),String(data.phone||''),passwordHash_(id,temp),true,new Date()]);
  return {ok:true,id:id,name:name,temporaryPassword:temp};
}
function setFacultyActive_(session,id,active){
  if(session.role!=='admin')throw new Error('Admin access required.');
  var sh=ensureFacultySheet_(); if(sh.getLastRow()<2)throw new Error('Faculty not found.');
  var rows=sh.getRange(2,1,sh.getLastRow()-1,7).getValues();
  for(var i=0;i<rows.length;i++)if(String(rows[i][0]).toUpperCase()===String(id).toUpperCase()){sh.getRange(i+2,7).setValue(!!active);return {ok:true};}
  throw new Error('Faculty not found.');
}
function deleteFacultyAccount_(session,id){
  if(session.role!=='admin')throw new Error('Admin access required.');
  var sh=ensureFacultySheet_(); for(var r=sh.getLastRow();r>=2;r--)if(String(sh.getRange(r,1).getValue()).toUpperCase()===String(id).toUpperCase()){sh.deleteRow(r);return {ok:true};}
  throw new Error('Faculty not found.');
}
function ensureAssignmentsSheet_(){
  var sh=getSS_().getSheetByName('ASSIGNMENTS');
  if(!sh){sh=getSS_().insertSheet('ASSIGNMENTS');sh.getRange(1,1,1,10).setValues([['Assignment ID','Title','Subject','Instructions','Due Date','Faculty ID','Faculty Name','Created At','Status','Allowed Types']]);sh.setFrozenRows(1);}
  return sh;
}
function ensureSubmissionsSheet_(){
  var sh=getSS_().getSheetByName('WORK_SUBMISSIONS');
  if(!sh){sh=getSS_().insertSheet('WORK_SUBMISSIONS');sh.getRange(1,1,1,13).setValues([['Submission ID','Assignment ID','Student ID','Student Name','File Name','File URL','Mime Type','Submitted At','Status','Marks','Feedback','Reviewed By','Faculty ID']]);sh.setFrozenRows(1);}
  return sh;
}
function isArchitecturalDesignSubject_(subject){
  return String(subject||'').trim().toLowerCase().replace(/[^a-z]/g,'') === 'architecturaldesign';
}
function canManageAssignment_(session, row){
  if(session.role==='class_rep') return true;
  if(session.role==='studio_head') return isArchitecturalDesignSubject_(row[2]);
  if(session.role==='faculty') return String(row[5])===String(session.username);
  return false;
}
function listAssignments_(session){
  if(session.role==='admin') throw new Error('Admin accounts do not have Academic Work access.');
  var a=ensureAssignmentsSheet_(), sub=ensureSubmissionsSheet_();
  var assignments=a.getLastRow()>1?a.getRange(2,1,a.getLastRow()-1,10).getValues():[];
  var submissions=sub.getLastRow()>1?sub.getRange(2,1,sub.getLastRow()-1,13).getValues():[];
  var visibleRows=assignments.filter(function(r){
    var status=String(r[8]||'Open');
    if(status==='Deleted') return false;
    if(session.role==='studio_head') return isArchitecturalDesignSubject_(r[2]);
    if(session.role==='faculty') return String(r[5])===String(session.username);
    if(session.role==='class_rep') return true;
    if(session.role==='student') return status==='Open';
    return false;
  });
  var visibleIds={};
  visibleRows.forEach(function(r){visibleIds[String(r[0])]=true;});
  return {
    assignments:visibleRows.map(function(r){return {id:String(r[0]),title:String(r[1]),subject:String(r[2]),instructions:String(r[3]),dueDate:r[4] instanceof Date?Utilities.formatDate(r[4],Session.getScriptTimeZone(),'yyyy-MM-dd'):String(r[4]),facultyId:String(r[5]),facultyName:String(r[6]),status:String(r[8]||'Open')};}),
    submissions:submissions.filter(function(r){
      if(!visibleIds[String(r[1])]) return false;
      if(session.role==='faculty') return String(r[12]||'')===String(session.username);
      if(session.role==='studio_head'||session.role==='class_rep') return true;
      if(session.role==='student') return String(r[2]).toUpperCase()===String(session.username).toUpperCase();
      return false;
    }).map(function(r){return {id:String(r[0]),assignmentId:String(r[1]),studentId:String(r[2]),studentName:String(r[3]),fileName:String(r[4]),fileUrl:String(r[5]),submittedAt:r[7] instanceof Date?Utilities.formatDate(r[7],Session.getScriptTimeZone(),'yyyy-MM-dd HH:mm'):String(r[7]),status:String(r[8]),marks:String(r[9]),feedback:String(r[10]),reviewedBy:String(r[11])};})
  };
}
function createAssignment_(session,data){
  if(['faculty','studio_head','class_rep'].indexOf(session.role)<0) throw new Error('Academic assignment access required.');
  data=data||{}; var title=String(data.title||'').trim(), subject=String(data.subject||'').trim();
  if(!title) throw new Error('Assignment title is required.');
  if(!subject) throw new Error('Subject is required.');
  if(session.role==='studio_head'&&!isArchitecturalDesignSubject_(subject)) throw new Error('Studio Head can create assignments only for Architectural Design.');
  var id='ASG-'+Utilities.getUuid().slice(0,8).toUpperCase();
  ensureAssignmentsSheet_().appendRow([id,title,subject,String(data.instructions||''),String(data.dueDate||''),session.username,session.name,new Date(),'Open','PDF,Image,DOC']);
  return {ok:true,id:id};
}
function updateAssignment_(session,assignmentId,data){
  if(['faculty','studio_head','class_rep'].indexOf(session.role)<0) throw new Error('Academic assignment access required.');
  data=data||{}; var sh=ensureAssignmentsSheet_(), last=sh.getLastRow();
  if(last<2) throw new Error('Assignment not found.');
  var rows=sh.getRange(2,1,last-1,10).getValues();
  for(var i=0;i<rows.length;i++) if(String(rows[i][0])===String(assignmentId)){
    if(!canManageAssignment_(session,rows[i])) throw new Error('You do not have permission to edit this assignment.');
    var title=String(data.title||'').trim(), subject=String(data.subject||'').trim();
    if(!title||!subject) throw new Error('Assignment title and subject are required.');
    if(session.role==='studio_head'&&!isArchitecturalDesignSubject_(subject)) throw new Error('Studio Head can manage only Architectural Design.');
    sh.getRange(i+2,2,1,4).setValues([[title,subject,String(data.instructions||''),String(data.dueDate||'')]]);
    return {ok:true,message:'Assignment and calendar deadline updated.'};
  }
  throw new Error('Assignment not found.');
}
function deleteAssignment_(session,assignmentId){
  if(['faculty','studio_head','class_rep'].indexOf(session.role)<0) throw new Error('Academic assignment access required.');
  var sh=ensureAssignmentsSheet_(), last=sh.getLastRow(); if(last<2) throw new Error('Assignment not found.');
  var rows=sh.getRange(2,1,last-1,10).getValues();
  for(var i=0;i<rows.length;i++) if(String(rows[i][0])===String(assignmentId)){
    if(!canManageAssignment_(session,rows[i])) throw new Error('You do not have permission to delete this assignment.');
    sh.getRange(i+2,9).setValue('Deleted');
    return {ok:true,message:'Assignment deleted from the active list. Existing submissions are preserved.'};
  }
  throw new Error('Assignment not found.');
}
function submitAssignment_(session,assignmentId,file){
  if(session.role!=='student')throw new Error('Student login required to submit work.');
  var a=ensureAssignmentsSheet_(), rows=a.getLastRow()>1?a.getRange(2,1,a.getLastRow()-1,10).getValues():[];
  var assignment=rows.find(function(r){return String(r[0])===String(assignmentId)&&String(r[8]||'Open')==='Open';}); if(!assignment)throw new Error('Assignment is unavailable or closed.');
  file=file||{}; var dataUrl=String(file.dataUrl||''), match=dataUrl.match(/^data:(application\/pdf|image\/[a-zA-Z0-9.+-]+|application\/msword|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document);base64,([\s\S]+)$/);
  if(!match)throw new Error('Upload PDF, image, or DOC file.'); if(dataUrl.length>11000000)throw new Error('File is too large. Maximum upload size is 8 MB.');
  var blob=Utilities.newBlob(Utilities.base64Decode(match[2]),match[1],String(file.name||'submission').replace(/[\\/:*?"<>|]/g,'_'));
  var folderId=PropertiesService.getScriptProperties().getProperty('ARMAADHA_WORK_FOLDER_ID'), folder;
  if(folderId){try{folder=DriveApp.getFolderById(folderId);}catch(e){folder=null;}}
  if(!folder){folder=DriveApp.createFolder('ARMAADHA Work Submissions');PropertiesService.getScriptProperties().setProperty('ARMAADHA_WORK_FOLDER_ID',folder.getId());}
  var saved=folder.createFile(blob); saved.setSharing(DriveApp.Access.PRIVATE,DriveApp.Permission.NONE);
  var profile=getProfileByArid_(session.username), studentName=profile?profile.data.name:session.name;
  var sh=ensureSubmissionsSheet_(), old=sh.getLastRow()>1?sh.getRange(2,1,sh.getLastRow()-1,12).getValues():[];
  for(var i=old.length-1;i>=0;i--)if(String(old[i][1])===String(assignmentId)&&String(old[i][2]).toUpperCase()===String(session.username).toUpperCase()){sh.deleteRow(i+2);}
  sh.appendRow(['SUB-'+Utilities.getUuid().slice(0,8),assignmentId,session.username,studentName,blob.getName(),saved.getUrl(),match[1],new Date(),'Submitted','','','',String(assignment[5])]);
  return {ok:true,message:'Work submitted successfully.'};
}
function updateSubmissionStatus_(session,submissionId,status){
  if(['studio_head','class_rep'].indexOf(session.role)<0) throw new Error('Only Studio Head or Class Representative can manage submission status.');
  var allowed=['Submitted','Under Review','Approved','Resubmission Required','Late'];
  status=String(status||'').trim();
  if(allowed.indexOf(status)<0) throw new Error('Invalid submission status.');
  var sh=ensureSubmissionsSheet_(); if(sh.getLastRow()<2) throw new Error('Submission not found.');
  var rows=sh.getRange(2,1,sh.getLastRow()-1,13).getValues();
  var assignmentRows=ensureAssignmentsSheet_(), arows=assignmentRows.getLastRow()>1?assignmentRows.getRange(2,1,assignmentRows.getLastRow()-1,10).getValues():[];
  for(var i=0;i<rows.length;i++) if(String(rows[i][0])===String(submissionId)){
    var assignment=arows.find(function(a){return String(a[0])===String(rows[i][1]);});
    if(!assignment) throw new Error('Related assignment not found.');
    if(session.role==='studio_head'&&!isArchitecturalDesignSubject_(assignment[2])) throw new Error('Studio Head can manage Architectural Design submissions only.');
    sh.getRange(i+2,9).setValue(status);
    return {ok:true,message:'Submission status updated.'};
  }
  throw new Error('Submission not found.');
}
function gradeSubmission_(session,submissionId,status,marks,feedback){
  if(session.role!=='faculty')throw new Error('Only Faculty can edit marks, grades, and feedback.');
  var sh=ensureSubmissionsSheet_(); if(sh.getLastRow()<2)throw new Error('Submission not found.');
  var rows=sh.getRange(2,1,sh.getLastRow()-1,13).getValues();
  for(var i=0;i<rows.length;i++)if(String(rows[i][0])===String(submissionId)){
    if(session.role==='faculty'&&String(rows[i][12]||'')!==String(session.username))throw new Error('You can review only your own assignment submissions.');
    sh.getRange(i+2,9,1,4).setValues([[String(status||'Reviewed'),String(marks||''),String(feedback||''),session.username]]);return {ok:true};
  }
  throw new Error('Submission not found.');
}
