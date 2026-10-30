import fs from "node:fs/promises";
import path from "node:path";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Header, Footer, PageNumber, ImageRun, Table, TableRow, TableCell, WidthType, ShadingType } from "docx";
import PDFDocument from "pdfkit";
import sharp from "sharp";
import type { ArtifactSnapshot, GeneratedFile } from "@/lib/artifacts/model";
import { documentSections, fact, FIELD_LABELS, KIND_LABELS } from "@/lib/artifacts/model";
const green="073F36", gold="C99439", ivory="F8F6F0";
const asset = (file:string) => path.join(process.cwd(),"public/brand",file);
export async function transparentArtifactLogo():Promise<Buffer> {
  const source=await fs.readFile(asset("pcc-logo-transparent.svg"));
  const {data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const w=info.width,h=info.height,c=info.channels;
  const pixel=(x:number,y:number)=>(y*w+x)*c;
  const corners=[[0,0],[w-1,0],[0,h-1],[w-1,h-1]];
  const backgrounds=corners.map(([x,y])=>{const i=pixel(x,y);return [data[i],data[i+1],data[i+2]];});
  // Remove only the matching background connected to the outside edge.
  // Avoid erasing pale parts enclosed within the official mark.
  const visited=new Uint8Array(w*h);
  const queue:number[]=[];
  const matches=(i:number,background:number[])=>
    Math.max(Math.abs(data[i]-background[0]),Math.abs(data[i+1]-background[1]),Math.abs(data[i+2]-background[2]))<24;
  for(const bg of backgrounds){
    for(let x=0;x<w;x++)for(const y of [0,h-1]){const i=pixel(x,y);if(matches(i,bg))queue.push(y*w+x);}
    for(let y=0;y<h;y++)for(const x of [0,w-1]){const i=pixel(x,y);if(matches(i,bg))queue.push(y*w+x);}
    while(queue.length){
      const pos=queue.pop()!;
      if(visited[pos])continue;
      const i=pos*c;
      if(!matches(i,bg))continue;
      visited[pos]=1;data[i+3]=0;
      const x=pos%w,y=Math.floor(pos/w);
      if(x>0)queue.push(pos-1);
      if(x<w-1)queue.push(pos+1);
      if(y>0)queue.push(pos-w);
      if(y<h-1)queue.push(pos+w);
    }
  }
  return sharp(data,{raw:{width:w,height:h,channels:4}}).png().toBuffer();
}
function lines(s:ArtifactSnapshot) {
  return documentSections(s).map(section => ({ title:section.title, text:section.rows.length ? section.rows.map(row => Object.entries(row).map(([k,v])=>`${FIELD_LABELS[k] ?? k}: ${fact(v)}`).join("\n")).join("\n\n") : "Evidência inexistente - não existem registos nesta secção." }));
}
export async function renderDocument(s:ArtifactSnapshot):Promise<GeneratedFile[]> {
  const logo = await transparentArtifactLogo();
  const label = `${KIND_LABELS[s.kind]} - ${fact(s.project.title)}`;
  const subtitle = `RASCUNHO PARA VALIDAÇÃO | MZN | ${s.generatedAt.slice(0,10)} | ${s.version}`;
  const sections = lines(s);
  const doc = new Document({ creator:"PCC", title:label,
    styles:{ default:{document:{run:{font:"DejaVu Sans",size:18,color:green},paragraph:{spacing:{after:100}}}}, paragraphStyles:[
      {id:"Title",name:"Title",basedOn:"Normal",run:{font:"DejaVu Sans",size:40,color:green,bold:true},paragraph:{spacing:{after:180}}},
      {id:"Heading1",name:"Heading 1",basedOn:"Normal",run:{font:"DejaVu Sans",size:24,color:green,bold:true},paragraph:{spacing:{before:180,after:100},keepNext:true}},
    ] },
    sections:[{ properties:{page:{margin:{top:1300,bottom:1100,left:1000,right:1000}}},
      headers:{default:new Header({children:[new Paragraph({children:[new ImageRun({type:"png",data:logo,transformation:{width:180,height:180*182/550}})]})]})},
      footers:{default:new Footer({children:[new Paragraph({alignment:AlignmentType.RIGHT,children:[new TextRun({text:`PCC | ${s.version.slice(0,8)} | Página `,size:14,color:green}),new TextRun({children:[PageNumber.CURRENT],size:14})]})]})},
      children:[new Paragraph({text:label,heading:HeadingLevel.TITLE}),new Paragraph({text:subtitle}),
        new Paragraph({text:"Conteúdo factual arquivado. Geração não substitui QA ou aceitação. Dados em falta permanecem explícitos."}),
        ...sections.flatMap(section=>[new Paragraph({text:section.title,heading:HeadingLevel.HEADING_1}), ...section.text.split("\n").map(text=>new Paragraph({text}))]),
        new Table({width:{size:100,type:WidthType.PERCENTAGE},rows:[new TableRow({children:[new TableCell({shading:{fill:green,type:ShadingType.CLEAR},children:[new Paragraph({children:[new TextRun({text:"Estado de validação",color:"FFFFFF",bold:true})]})]})]}),new TableRow({children:[new TableCell({shading:{fill:ivory,type:ShadingType.CLEAR},children:[new Paragraph("QA: pendente | Aceitação: pendente | Resultado: por validar")]})]})]})
      ]}]
  });
  const word=await Packer.toBuffer(doc);
  const pdf = await new Promise<Buffer>((resolve,reject)=>{
    const chunks:Buffer[]=[];const d=new PDFDocument({size:"A4",margins:{top:105,bottom:65,left:48,right:48},bufferPages:true,info:{Title:label,Author:"PCC"}});
    d.on("data",c=>chunks.push(c));d.on("end",()=>resolve(Buffer.concat(chunks)));d.on("error",reject);
    d.registerFont("PCC",asset("fonts/DejaVuSans.ttf"));d.registerFont("PCC-Bold",asset("fonts/DejaVuSans-Bold.ttf"));
    d.font("PCC-Bold").fillColor(`#${green}`).fontSize(20).text(label);
    d.moveDown(.5).font("PCC").fontSize(8).text(subtitle);
    d.moveDown().fontSize(9).text("Conteúdo factual arquivado. Geração não substitui QA ou aceitação. Dados em falta permanecem explícitos.");
    for(const section of sections){
      if(d.y>700)d.addPage();
      d.moveDown().font("PCC-Bold").fillColor(`#${green}`).fontSize(12).text(section.title);
      d.moveDown(.4).font("PCC").fontSize(9).text(section.text,{lineGap:3});
    }
    if(d.y>680)d.addPage();
    const validationY=d.y+12;
    d.rect(48,validationY,499,22).fill(`#${green}`);
    d.font("PCC-Bold").fillColor("white").fontSize(9).text("Estado de validação",56,validationY+5);
    d.rect(48,validationY+22,499,30).fill(`#${ivory}`);
    d.font("PCC").fillColor(`#${green}`).text("QA: pendente | Aceitação: pendente | Resultado: por validar",56,validationY+29);
    const range=d.bufferedPageRange();
    for(let i=0;i<range.count;i++){
      d.switchToPage(i);d.image(logo,48,26,{width:160});
      d.save().strokeColor(`#${gold}`).moveTo(48,88).lineTo(547,88).stroke().restore();
      d.font("PCC").fontSize(7).fillColor(`#${green}`).text(`PCC | ${s.version.slice(0,8)} | Rascunho`,48,790,{lineBreak:false});
      d.text(`Página ${i+1}`,470,790,{lineBreak:false});
    }d.end();
  });
  return [{extension:"docx",mime:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",bytes:word},{extension:"pdf",mime:"application/pdf",bytes:pdf}];
}
export async function renderArtifact(s:ArtifactSnapshot):Promise<GeneratedFile[]> {
  if(s.kind === "spreadsheet") {
    const {default:ExcelJS}=await import("exceljs");const w=new ExcelJS.Workbook();w.creator="PCC";
    const image=w.addImage({base64:`data:image/png;base64,${(await fs.readFile(asset("pcc-logo-official.png"))).toString("base64")}`,extension:"png"});
    for(const section of documentSections(s)){
      const sheet=w.addWorksheet(section.title.slice(0,31).replace(/[\\/*?:\[\]]/g," "));
      sheet.addImage(image,{tl:{col:0,row:0},ext:{width:200,height:200*182/550}});
      sheet.mergeCells("A5:C5");sheet.getCell("A5").value=`PCC | Rascunho | MZN | ${s.version}`;sheet.getRow(5).height=30;
      const header=sheet.addRow(["Registo","Campo","Valor"]);
      header.eachCell(c=>{c.fill={type:"pattern",pattern:"solid",fgColor:{argb:green}};c.font={bold:true,color:{argb:"FFFFFF"}};});
      for(const [index,row] of section.rows.entries())for(const [key,value] of Object.entries(row)){
        const parts=typeof value==="number"?[value]:(fact(value).match(/[\s\S]{1,800}/g)??[""]);
        for(const part of parts){const r=sheet.addRow([index+1,FIELD_LABELS[key]??key,part]);r.height=Math.max(22,Math.ceil(String(part).length/70)*15+10);}
      }
      if(!section.rows.length)sheet.addRow(["","Estado","Evidência inexistente - sem registos."]);
      sheet.columns.forEach((c,i)=>{c.width=[12,30,80][i]??30;c.alignment={wrapText:true,vertical:"top"};});
      sheet.views=[{state:"frozen",ySplit:7}];sheet.pageSetup={orientation:"landscape",fitToPage:true,fitToWidth:1,fitToHeight:0};
      sheet.headerFooter.oddFooter='PCC | Rascunho &R&P / &N';
    }
    return [{extension:"xlsx",mime:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",bytes:Buffer.from(await w.xlsx.writeBuffer())}];
  }
  if(s.kind === "presentation") {
    const {default:PptxGenJS}=await import("pptxgenjs");const p=new PptxGenJS();p.layout="LAYOUT_WIDE";p.author="PCC";p.subject="Rascunho factual para validação";
    const logo=(await fs.readFile(asset("pcc-logo-official.png"))).toString("base64");
    let slideNumber=0;
    for(const section of lines(s)){
      // Separate slides by content length; never clip long source records.
      const chunks=section.text.match(/[\s\S]{1,850}/g)??[""];
      for(const [i,text] of chunks.entries()){
        const slide=p.addSlide();slideNumber++;slide.background={color:ivory};
        slide.addImage({data:`image/png;base64,${logo}`,x:.5,y:.18,w:2.2,h:2.2*182/550});
        slide.addText(`${section.title}${chunks.length>1?` (${i+1}/${chunks.length})`:""}`,{x:.5,y:1.1,w:12.3,h:.6,fontSize:24,color:green,bold:true});
        slide.addText(text,{x:.6,y:1.9,w:12.1,h:4.7,fontSize:16,color:green,breakLine:false,margin:4,fit:"shrink"});
        slide.addText(`PCC | RASCUNHO | ${s.version.slice(0,8)} | ${slideNumber}`,{x:.5,y:7,w:12,h:.2,fontSize:9,color:green});
      }
    }
    return [{extension:"pptx",mime:"application/vnd.openxmlformats-officedocument.presentationml.presentation",bytes:Buffer.from(await p.write({outputType:"nodebuffer"}) as ArrayBuffer)}];
  }
  return renderDocument(s);
}
