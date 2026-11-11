import { escapeHtml } from '../utils/escape-html.js';

// Read-only Professional 9×3 card presentation. User never owns a separate card editor.
export const ENTITY_CARD_LINE_COUNT = 9;
export const ENTITY_CARD_DEFAULT_GRADIENT = Object.freeze({
  from:'#2C2A28',
  mid:'#817A73',
  to:'#D7D1CA',
  angle:145,
});

const COLUMNS = ['left','center','right'];
const ALIGNS = new Set(['left','center','right']);
const SIZES = new Set(['s','m','l','xl']);
const LEGACY_TEXT_COLORS = Object.freeze({black:'#111111',gray:'#777A7D',white:'#FFFFFF'});

function bool(value){return Boolean(value)}
function choice(value,set,fallback){const next=String(value||'');return set.has(next)?next:fallback}
function hex(value,fallback){const next=String(value||'').trim().toUpperCase();return /^#[0-9A-F]{6}$/.test(next)?next:fallback}
function number(value,fallback,min,max){const next=Number(value);return Number.isFinite(next)?Math.max(min,Math.min(max,next)):fallback}
function textColor(value){
  const input=String(value||'').trim();
  return LEGACY_TEXT_COLORS[input.toLowerCase()]||hex(input,'#FFFFFF');
}


function normalizeCell(input = {}, column = 'left') {
  const cell=input&&typeof input==='object'&&!Array.isArray(input)?input:{};
  return {
    field:String(cell.field||''),align:choice(cell.align,ALIGNS,column==='right'?'right':column==='center'?'center':'left'),
    size:choice(cell.size,SIZES,'m'),color:textColor(cell.color),
    bold:bool(cell.bold),italic:bool(cell.italic),underline:bool(cell.underline),uppercase:bool(cell.uppercase),
  };
}

export function hasConfiguredEntityCardAppearance(value = {}) {
  return Array.isArray(value?.lines)&&value.lines.some(row=>
    Boolean(String(row?.field||'').trim()) ||
    COLUMNS.some(col=>Boolean(String(row?.cells?.[col]?.field||'').trim()))
  );
}

export function normalizeEntityCardAppearance(value = {}) {
  const source=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  const gradient=source.gradient&&typeof source.gradient==='object'&&!Array.isArray(source.gradient)?source.gradient:{};
  const lines=Array.isArray(source.lines)?source.lines:[];
  return {
    gradient:{
      from:hex(gradient.from,ENTITY_CARD_DEFAULT_GRADIENT.from),
      mid:hex(gradient.mid,ENTITY_CARD_DEFAULT_GRADIENT.mid),
      to:hex(gradient.to,ENTITY_CARD_DEFAULT_GRADIENT.to),
      angle:number(gradient.angle,ENTITY_CARD_DEFAULT_GRADIENT.angle,0,360),
    },
    lines:Array.from({length:ENTITY_CARD_LINE_COUNT},(_,index)=>{
      const raw=lines[index]&&typeof lines[index]==='object'&&!Array.isArray(lines[index])?lines[index]:{};
      const existing=raw.cells&&typeof raw.cells==='object'&&!Array.isArray(raw.cells)?raw.cells:{};
      const cells=Object.fromEntries(COLUMNS.map(col=>[col,normalizeCell(existing[col],col)]));
      // Previously there was one value per row. Its old position determines
      // the new cell; text alignment remains an independent formatting choice.
      if(String(raw.field||'').trim()){
        const position=raw.zone==='left'||raw.zone==='right'?raw.zone
          :raw.align==='center'||raw.align==='right'?raw.align:'left';
        const target=!cells[position].field?position:
          COLUMNS.find(col=>!cells[col].field);
        if(target)cells[target]=normalizeCell(raw,target);
      }
      return {cells};
    }),
  };
}

// Field-name changes are defined by the card type, never by the shared grid.
export function remapEntityCardAppearanceFields(value = {}, names = {}) {
  const appearance=normalizeEntityCardAppearance(value);
  return {
    ...appearance,
    lines:appearance.lines.map(row=>({
      cells:Object.fromEntries(COLUMNS.map(column=>[column,{
        ...row.cells[column],
        field:Object.prototype.hasOwnProperty.call(names,row.cells[column].field)
          ? String(names[row.cells[column].field]) : row.cells[column].field,
      }])),
    })),
  };
}

// One canonical default layout builder for every card type.
export function entityCardDefaultRows(entries = []) {
  const rows=normalizeEntityCardAppearance({}).lines;
  for(const entry of Array.isArray(entries)?entries:[]){
    const index=Number(entry?.row)-1;
    if(!Number.isInteger(index)||index<0||index>=ENTITY_CARD_LINE_COUNT)continue;
    const column=COLUMNS.includes(entry?.column)?entry.column:'left';
    rows[index].cells[column]=normalizeCell(entry,column);
  }
  return rows;
}

export function entityCardFieldRegistry(items = []) {
  const seen=new Set();
  return (Array.isArray(items)?items:[]).map((item)=>{
    const value=String(item?.value||'').trim();
    if(!value||seen.has(value))return null;
    seen.add(value);
    return {value,label:String(item?.label||value),text:String(item?.text??'')};
  }).filter(Boolean);
}

function fieldMap(fields){return new Map(entityCardFieldRegistry(fields).map((item)=>[item.value,item]))}
function lineText(line,map){
  const text=map.get(line.field)?.text||'';
  return line.uppercase?String(text).toLocaleUpperCase('ru-RU'):String(text);
}

export function entityVisualCard({appearance={},fields=[],image='',imagePosition='50% 50%',interactive=false,data='',aria='',className='',badge=''}={}) {
  const config=normalizeEntityCardAppearance(appearance);
  const map=fieldMap(fields);
  const style=[
    `--entity-visual-gradient:linear-gradient(${config.gradient.angle}deg,${config.gradient.from} 0%,${config.gradient.mid} 54%,${config.gradient.to} 100%)`,
    image?`--entity-visual-image:url('${escapeHtml(String(image))}')`:'',
    `--entity-visual-image-position:${escapeHtml(String(imagePosition||'50% 50%'))}`,
  ].filter(Boolean).join(';');
  const tag=interactive?'button':'section';
  const attrs=interactive?`type="button"${data?` ${data}`:''}${aria?` aria-label="${escapeHtml(aria)}"`:''}`:'';

  const rows=config.lines.map((row,index)=>{
    const cells=COLUMNS.map((col,i)=>{
      const cell=row.cells[col];
      // Reserve configured cells. Text may extend into adjacent empty cells
      // in its alignment direction, but never over a configured neighbor.
      let left=0,right=0;
      for(let j=i-1;j>=0&&!row.cells[COLUMNS[j]].field;j--)left++;
      for(let j=i+1;j<3&&!row.cells[COLUMNS[j]].field;j++)right++;
      const available=cell.align==='left'?1+right
        :cell.align==='right'?1+left
        :1+2*Math.min(left,right);
      const classes=[
        'entity-visual-card__cell','is-align-'+cell.align,
        'is-size-'+cell.size,
        cell.bold?'is-bold':'',cell.italic?'is-italic':'',cell.underline?'is-underline':'',
      ].filter(Boolean).join(' ');
      return `<span class="${classes}" style="color:${cell.color}" data-entity-card-line="${index+1}" data-entity-card-column="${col}"><span class="entity-visual-card__text" style="--spill-width:${available}">${escapeHtml(lineText(cell,map))}</span></span>`;
    }).join('');
    return `<span class="entity-visual-card__row">${cells}</span>`;
  }).join('');
  const badgeMarkup = badge ? `<span class="entity-visual-card__badge">${escapeHtml(String(badge))}</span>` : '';
  return `<${tag} class="entity-visual-card${image?' has-image':''}${className?` ${escapeHtml(className)}`:''}" style="${style}"${attrs}><span class="entity-visual-card__surface" aria-hidden="true"></span><span class="entity-visual-card__grid">${rows}</span>${badgeMarkup}</${tag}>`;
}
