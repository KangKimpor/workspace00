import type { Page } from '@veloradesk/core/model';
export const localDate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
export const displayDate = (value:string) => new Date(`${value.slice(0,10)}T12:00:00`).toLocaleDateString(undefined,{month:'short',day:'numeric'});
export const titleOf = (page:Page) => page.properties.__locked ? 'Locked entry' : page.title || 'Untitled';
export const pageIcon = (page:Page) => page.icon || (page.type === 'journal' ? '📓' : page.type === 'database' ? '▦' : '📄');
export const readSetting=(key:string,fallback:string)=>{try{return localStorage.getItem(key)??fallback;}catch{return fallback;}};
export const writeSetting=(key:string,value:string)=>{try{localStorage.setItem(key,value);}catch{/* Keep this session usable when storage is full. */}};
