import {plantSources, type PlantSource} from './plant-sources.ts';
// 発電所の電源の種類を ID で引く。表（自動生成の plant-sources.ts）に自分の項目としてあるときだけ返す（"__proto__"・"constructor" などで組み込みを返さない。2026-11-02）
export const plantSourceOf=(id:string):PlantSource|undefined=>Object.hasOwn(plantSources,id)?plantSources[id]:undefined;
// 発電所は電源ごとの色の丸に白い絵（2026-10-07、案B）。電源が分からない発電所は今までの茶色の丸。
export const PLANT_SOURCES:{key:PlantSource;label:string;color:string}[]=[
 {key:'hydro',label:'水力',color:'#185FA5'},{key:'thermal',label:'火力',color:'#D85A30'},{key:'nuclear',label:'原子力',color:'#534AB7'},{key:'biomass',label:'バイオマス',color:'#3B6D11'},
 {key:'solar',label:'太陽光',color:'#BA7517'},{key:'wind',label:'風力',color:'#0F6E56'},{key:'geothermal',label:'地熱',color:'#993556'},
];
const W='#fff';
const GLYPH:Record<PlantSource,string>={
 hydro:`<path d="M12 5.2C9.6 8.6 8.3 10.8 8.3 13.1a3.7 3.7 0 0 0 7.4 0c0-2.3-1.3-4.5-3.7-7.9z" fill="${W}"/>`,
 thermal:`<path d="M12.2 5c.8 2.9 3.6 4.4 3.6 8.1a3.8 3.8 0 0 1-7.6 0c0-2.1 1.2-3.2 1.9-4.6.4 1.4 1 2.1 1.6 2.4.4-1.8.8-3.6.5-5.9z" fill="${W}"/>`,
 nuclear:`<g fill="none" stroke="${W}" stroke-width="1.15"><ellipse cx="12" cy="12" rx="5.6" ry="2.1"/><ellipse cx="12" cy="12" rx="5.6" ry="2.1" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="5.6" ry="2.1" transform="rotate(-60 12 12)"/></g><circle cx="12" cy="12" r="1.3" fill="${W}"/>`,
 biomass:`<path d="M7.4 16.4C7 10.6 10.4 7.4 16.8 7.2c.2 6.3-3.4 9.6-9.4 9.2z" fill="${W}"/>`,
 solar:`<circle cx="12" cy="12" r="2.6" fill="${W}"/><path d="M12 5.6v1.6M12 16.8v1.6M5.6 12h1.6M16.8 12h1.6M7.5 7.5l1.1 1.1M15.4 15.4l1.1 1.1M7.5 16.5l1.1-1.1M15.4 8.6l1.1-1.1" stroke="${W}" stroke-width="1.3" stroke-linecap="round"/>`,
 wind:`<path d="M12 11.6V18M12 11.6V5.6M12 11.6l-5 3M12 11.6l5 3" stroke="${W}" stroke-width="1.5" stroke-linecap="round"/><circle cx="12" cy="11.6" r="1.2" fill="${W}"/>`,
 geothermal:`<path d="M9 17c-1.2-1.4 1.2-2.6 0-4s1.2-2.6 0-4M12 17c-1.2-1.4 1.2-2.6 0-4s1.2-2.6 0-4M15 17c-1.2-1.4 1.2-2.6 0-4s1.2-2.6 0-4" fill="none" stroke="${W}" stroke-width="1.4" stroke-linecap="round"/>`,
};
/** Fixed equipment symbols. Converter arrows describe equipment, never live flow. */
/** 需要家（2026-10-11）：六角形。変電所の□・開閉所の◇・発電所の○と形で見分ける */
export const CUSTOMER_COLOR='#7a6248';
export function facilitySymbol(kind: 'substation'|'switchyard'|'plant'|'converter'|'customer', source?: PlantSource|null): string {
 // 知らない種別は種別なしの丸（落とさない。2026-11-02）
 const known=kind==='plant'&&source?PLANT_SOURCES.find(s=>s.key===source):undefined;
 if(known){const c=known.color;
  return `<svg class="equipment-glyph plant-source plant-${known.key}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g class="equipment-halo"><circle cx="12" cy="12" r="9.4"/></g><circle class="plant-disc" cx="12" cy="12" r="9.4" fill="${c}"/>${GLYPH[known.key]}</svg>`;}
 const shape=kind==='customer'?'<path d="M7.5 4.2h9l4.5 7.8-4.5 7.8h-9L3 12Z"/>':kind==='switchyard'?'<path d="M12 3 21 12 12 21 3 12Z"/>':kind==='plant'?'<circle cx="12" cy="12" r="7"/>':'<rect x="4" y="4" width="16" height="16"/>';
 const arrows=kind==='converter'?'<path class="equipment-arrows" d="M7 9h10M14 7l3 2-3 2M17 15H7M10 13l-3 2 3 2"/>':'';
 return `<svg class="equipment-glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g class="equipment-halo">${shape}</g><g class="equipment-outline">${shape}</g>${arrows}</svg>`;
}
