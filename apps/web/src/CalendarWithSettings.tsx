import { useEffect, type ComponentProps } from "react";
import CalendarModule from "./CalendarModule";

/** Child effects register Calendar's listener before this pending handoff fires. */
export default function CalendarWithSettings({requestSettings,onSettingsOpened,...props}:ComponentProps<typeof CalendarModule>&{requestSettings:boolean;onSettingsOpened:()=>void}) {
  useEffect(()=>{if(requestSettings){window.dispatchEvent(new Event("kimpor-calendar-settings"));onSettingsOpened();}},[requestSettings,onSettingsOpened]);
  return <CalendarModule {...props}/>;
}
