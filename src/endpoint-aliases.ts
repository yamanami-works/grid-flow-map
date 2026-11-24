// Scoped evidence, not a general rule for removing facility suffixes.
// OCCTO 十和田幹線 500kV「上北 → 岩手」 and Tohoku NW No.0002:
// 上北変電所 → 岩手変電所. Existing asset: asset-15b96f34-80a2-4e1e-b6bd-e7239314edd0.
// https://www.tohoku-epco.co.jp/pastnews/normal/1183353_1049.html
// See docs/TOWADA_FLOW_REVIEW.md for geometry and source evidence.
// OCCTO 常磐北幹線「西仙台変電所 → 宮城丸森」/ 常磐南幹線「宮城丸森 → 南相馬変電所」: 宮城丸森 is 宮城丸森開閉所
// (Tohoku NW 2026-05-08, https://nw.tohoku-epco.co.jp/news/pdf/__icsFiles/afieldfile/2026/05/08/260508001.pdf). See docs/TOHOKU_JOBAN_SPLIT.md.
export function endpointName(record:{name:string;voltageKV:number},name:string):string {
 const normalized=name.normalize('NFKC').replace(/\s/g,'');
 if(record.name.normalize('NFKC').replace(/\s/g,'')==='十和田幹線'&&record.voltageKV===500&&normalized==='上北')return '上北変電所';
 if(/^常磐[北南]幹線$/.test(record.name.normalize('NFKC').replace(/\s/g,''))&&record.voltageKV===500&&normalized==='宮城丸森')return '宮城丸森開閉所';
 // 2026-10-01 東北の見直し（docs/TOHOKU_REVIEW.md）：OCCTOの略称を東北電力NW公表の設備名に対応
 const line=record.name.normalize('NFKC').replace(/\s/g,'');
 if(record.voltageKV===275&&['北青幹線','北部幹線'].includes(line)&&normalized==='上北')return '上北変電所';
 if(record.voltageKV===275&&line==='名取幹線'&&normalized==='名取')return '名取変電所';
 if(record.voltageKV===275&&line==='東上越幹線'&&normalized==='信濃川')return '信濃川水力発電所';
 return normalized;
}
