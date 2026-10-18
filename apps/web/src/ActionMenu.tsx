import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Pressable } from "@veloradesk/ui";
import { Check } from "./Coolicons";

export default function ActionMenu({ label, children, className = "ws-button", items }: { label:string; children:ReactNode; className?:string; items:{ label:string; onSelect:()=>void; icon?:ReactNode; shortcut?:string; checked?:boolean; section?:string; disabled?:boolean }[] }) {
  const [open,setOpen] = useState(false), [position,setPosition] = useState({top:0,left:0});
  const trigger = useRef<HTMLButtonElement>(null), menu = useRef<HTMLDivElement>(null);
  const close = () => { setOpen(false); trigger.current?.focus({preventScroll:true}); };
  const show = () => {
    const rect=trigger.current!.getBoundingClientRect();
    setPosition({top:Math.max(8,Math.min(rect.bottom+4,innerHeight-Math.min(320,items.length*44+16)-8)),left:Math.max(8,Math.min(rect.left,innerWidth-228))}); setOpen(true);
  };
  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    const outside=(event:PointerEvent) => { if (!menu.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setOpen(false); };
    const resize=()=>setOpen(false);
    document.addEventListener('pointerdown',outside); window.addEventListener('resize',resize);
    return () => { document.removeEventListener('pointerdown',outside); window.removeEventListener('resize',resize); };
  },[open]);
  return <><Pressable ref={trigger} className={className} aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={()=>open ? close():show()} onKeyDown={event=>{if(event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229)return;if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {event.preventDefault();show();}}}>{children}</Pressable>
    {open && createPortal(<div ref={menu} className="ws-option-menu" role="menu" aria-label={label} style={{position:'fixed',...position,minWidth:220,maxWidth:'calc(100vw - 16px)'}} onKeyDown={event=>{if(event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229)return;
      if (event.key === 'Escape') {event.preventDefault(); event.stopPropagation();close();return;}
      if (event.key === 'Tab') {setOpen(false);return;}
      const buttons=[...menu.current!.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')], current=buttons.indexOf(document.activeElement as HTMLButtonElement);
      const index=event.key === 'ArrowDown' ? (current+1)%buttons.length:event.key === 'ArrowUp' ? (current-1+buttons.length)%buttons.length:event.key === 'Home' ? 0:event.key === 'End' ? buttons.length-1:null;
      if (index !== null) {event.preventDefault();buttons[index]?.focus();}
    }}>{items.map((item,index)=><Fragment key={index}>{item.section && <div className="ws-menu-section" role="presentation">{item.section}</div>}<Pressable className="ws-option-item" role="menuitem" tabIndex={-1} disabled={item.disabled} onClick={()=>{close();item.onSelect();}}>{item.icon}<span>{item.label}</span>{item.shortcut && <kbd>{item.shortcut}</kbd>}{item.checked && <Check size={16} />}</Pressable></Fragment>)}</div>,document.body)}
  </>;
}
