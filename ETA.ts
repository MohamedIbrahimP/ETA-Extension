// ------------------------------------------------------------------
// 0) Global helpers you already have
// ------------------------------------------------------------------
declare const $: any;
declare const XLSX: any;
declare const ExcelJS: any;
declare const JSZip:any;
declare const bootstrap: any;
let API : string = `https://api-portal.invoicing.eta.gov.eg/api/v1`;
let invoiceHref : string = `https://invoicing.eta.gov.eg/documents`;
let receiptHref : string = `https://invoicing.eta.gov.eg/documents`;
let currentPage : string = ``;
// let lastSearchedURL : string = ``;
let lastCallURL : string = ``;
let user_token: string = ``;
let responseTotalCount:number=0;
let taxpayerAddress:string ="";
let taxpayerRIN:string ="";
let cfg:any;
const taxPriority = [
  "ضريبه القيمه المضافه بالعمله",
  "ضريبه القيمه المضافه",
  "ضريبه الجدول (نسبيه)",
  "ضريبه الجدول (النوعية)",
  "الخصم تحت حساب الضريبه",
  "ضريبه الدمغه (نسبيه)",
  "ضريبه الدمغه (قطعيه بمقدار ثابت)",
  "ضريبة الملاهى",
  "رسم تنميه الموارد",
  "رسم خدمة",
  "رسم المحليات",
  "رسم التامين الصحى",
  "رسوم أخرى"
];

let uuidsList: any[] = [];
let headersList: any[] = [];
let detailsList: any[] = [];
let summaryList: any[] = [];

let headersHead= new Set<string>();
let detailsHead= new Set<string>();
let taxes =new Set<string>();

// -----------------------------------
// Hook XHR globally
(function () {
  if ((window as any)._xhrHooked) return;
  (window as any)._xhrHooked = true;

  const OriginalXHR = window.XMLHttpRequest;

  class CustomXHR extends OriginalXHR {
    constructor() {
      super();

      this.addEventListener("readystatechange", async function () {
        if (this.readyState !== 4 || this.status !== 200) return;

        // is this a /documents/search call?
        const invoicesUri = `${API}/documents`;
        const receiptsUri = `${API}/receipts`;
        
        // if (!this.responseURL.startsWith(`${invoicesUri}`) && !this.responseURL.startsWith(`${receiptsUri}`)) return;
        if (!this.responseURL.includes(`/recent`) && !this.responseURL.includes(`/search`)) return;

        // 2‑a) parse response
        const resp = JSON.parse(this.responseText);
        responseTotalCount = resp.metadata?.totalCount ?? 0;
        lastCallURL=this.responseURL;         

      });
    }
  }

  // replace the browser's XHR with our subclass
  window.XMLHttpRequest = CustomXHR as any;
})();
// DOM injection logic
window.addEventListener('load', () => {
   extension();
});
//
function extension() {
  const style = document.createElement('style');
style.textContent = `
  .modal-backdrop {
    z-index: 1050 !important;
  }
  .modal {
    z-index: 1055 !important;
  }
`;

    const observer = new MutationObserver(() => {
        setTimeout(() => {
            currentPage = location.href;
        
            const USER_DATA: any = localStorage.getItem('USER_DATA');
    const parsed = JSON.parse(USER_DATA || '{}');
    user_token = parsed.access_token || '';

                taxpayerRIN = localStorage.getItem('RIN')??'';


            if (currentPage.includes('invoices') || currentPage.endsWith('documents')) {              
                injectButton('Invoices');
            }
            if (currentPage.includes('receipts') || currentPage.endsWith('receipts')) {
                injectButton('Receipts');
              }
              injectSpinner();
              fetchAddress();
        }, 100);
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
    });
    document.head.appendChild(style);
   
}
function injectButton(lable) {
    let container;
     if (currentPage.includes('invoices') || currentPage.includes('documents')) 
               container = document.querySelector("div[role='tablist']");
              else
                container = document.querySelector(".subPivot [role='tablist']");
            
    if (!container || container.querySelector('#openModal')) return;

    const btn = document.createElement('button');
    btn.id = 'openModal';
    btn.textContent = `Export ${lable}`;
    btn.className = 'btn btn-primary ms-2';
    btn.onclick = async () => {  
     if (currentPage.includes('invoices') || currentPage.includes('documents')) {
               ensureModal("invoice");
               openModalById("eta-bootstrap-modal");
               document.getElementById("docCount")!.textContent = `عدد المستندات : ${responseTotalCount}`;
                document.getElementById("downloadExcelBtn")!.addEventListener("click", async ()=>{
                  await handleDownloadExcel('documents');
                });
                document.getElementById("downloadPDFBtn")!.addEventListener("click",async ()=>{
                  await handleDownloadPDF();
                } );
            }
            if (currentPage.includes('receipts')) {
                ensureModal("invoice");
       openModalById("eta-bootstrap-modal");
               document.getElementById("docCount")!.textContent = `عدد المستندات : ${responseTotalCount}`;
                document.getElementById("downloadExcelBtn")!.addEventListener("click", async()=>{
                 await handleDownloadExcel('receipts');
                });
              }
              loadTooltip();
};

    container.appendChild(btn);
}




async function handleDownloadPDF() {
  try {
    showSpinner(true);
    updateCount(0); // Reset UI
    await new Promise((r) => setTimeout(r, 50)); // Give browser time to paint spinner

    await fetchUUIDs();    
    await exportInvoicesZip();
  } catch (err) {
    console.error("❌ Error during PDF download:", err);
    alert("حدث خطأ أثناء تحميل الفواتير. يرجى المحاولة مرة أخرى.");
  } finally {
    showSpinner(false);
    $('#eta-bootstrap-modal').modal('hide');
  }
}
async function exportInvoicesZip(dir = "documents") {
  const zip = new JSZip();
  let downloaded = 0;

  for (const meta of uuidsList) {
    const blob = await fetchPdf(meta.uuid, dir);
    if (blob) {
      const fileName = `(${meta.docType})_${slugify(meta.internalId)}_${slugify(meta.partyName)}.pdf`;
      zip.file(fileName, blob);
    }
    downloaded++;
    updateCount(downloaded); // 👈 Show progress to user
  }

  const zipBlob = await zip.generateAsync({ type: "blob" });
  const link = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(zipBlob),
    download: 'invoices.zip'
  });

  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
}
function fetchPdf(uuid, dir = "documents") {
  return $.ajax({
    url: `${API}/${dir}/${uuid}/PDF`,
    method: "GET",
    headers: {
      "Authorization": `Bearer ${user_token}`,
      "accept-language": localStorage.i18nextLng || "ar"
    },
    xhrFields: {
      responseType: "blob"  // This is needed to get binary PDF data
    },
    timeout: 5000, // 1 seconds timeout
  }).then(
    function (data) {
      return data; // PDF blob
    },
    function (jqXHR, textStatus, errorThrown) {
      if (textStatus === "timeout") {
        console.warn(`Request for PDF timed out.`);
      } else {
        console.error(`Failed to fetch PDF for UUID ${uuid}`, errorThrown);
      }
      return null;
    }
  );
}


function slugify(text = '') {
  return text.replace(/[\/\\:*?"<>|]/g, '_').trim();
}
async function handleDownloadExcel(dir="documents") {

    const selected  = collectSelectedFields();          // Step 1 set of selected
    cfg       = buildConfigFromSelection(selected); // Step 2
  const colourHex = (document.getElementById('headerColor') as HTMLInputElement)?.value || '#0078d4';
  const textColourHex = (document.getElementById('headerTextColor') as HTMLInputElement)?.value || '#38925bff';

  
  try {
    showSpinner(true);
    await new Promise(r => setTimeout(r));  // give browser a chance to paint spinner
    await fetchUUIDs();
    await fetchDetails(dir);        
    await exportFilteredRowsExcelJS(colourHex,textColourHex); 
    }finally {
    showSpinner(false);
    $('#eta-bootstrap-modal').modal('hide');
  }
}

//#region  Excel functions 

async function exportFilteredRowsExcelJS(headerHex: string,textColourHex: string) {
  
  if (!headersList.length) { alert("Please Select Valid Search Criteria!"); return; }
const fillColor =ensureArgb(headerHex);
const textColor = ensureArgb(textColourHex);

  const wb  = new ExcelJS.Workbook();
  /**  Headers Sheet */
  const headersSheet  = wb.addWorksheet("Headers");

  const header = await getHeaders(headersHead,taxes);;
  const headers = ["ID",...header];
  headersSheet.columns = headers.map(h => ({
    header: h,
    key: h,
    style: { alignment: { horizontal: 'center' } }
  }));

  headersList.forEach((inv,index) => {
    const row=[index+1, ...header.map(h => inv[h] ?? '')];
    headersSheet.addRow(row).eachCell(c => c.alignment = { horizontal: 'center' });
  });
headersSheet.eachRow((row, rowNumber) => {
  row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    if (colNumber !== 1) {
      const isNumber = typeof cell.value === 'number' || (!isNaN(Number(cell.value)) && cell.value !== '');
      if (isNumber) {
        cell.numFmt = '#,##0.00';
      }
    }
    cell.font = { size: 12 };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });
});

  const hdr = headersSheet.getRow(1);
 
  hdr.eachCell(c => {
    c.font = { bold: true,size: 12, color: { argb: textColor } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillColor } };
  });
// 🟢 Call this *after* you have finished adding all rows to headersSheet
headersSheet.columns.forEach(col => {
  let max = 0;
  if (typeof col.header === 'string') {
    max = col.header.length;
  }
  col.eachCell({ includeEmpty: true }, cell => {
    const raw = cell.value ?? '';            // null/undefined → ''
    const len = String(raw).length;          // coerce to string
    if (len > max) max = len;
  });
  col.width = Math.min(Math.max(max + 8, 10), 50); // min 10, max 50
});
 hdr.height=22;


 /**  Details Sheet */
  const detailsSheet  = wb.addWorksheet("Details");

  const details = await getHeaders(detailsHead,taxes);
  const detailsHeader = ["ID",...details];
  detailsSheet.columns = detailsHeader.map(h => ({
    header: h,
    key: h,
    width: Math.max(h.length, ...detailsHeader.map(r => String(r[h] ?? '').length)) + 2,
    style: { alignment: { horizontal: 'center' } }
  }));

  detailsList.forEach((det,index) => {
    const row=[index+1, ...details.map(h => det[h] ?? '')];
    detailsSheet.addRow(row).eachCell(c => c.alignment = { horizontal: 'center' });
  });
detailsSheet.eachRow((row, rowNumber) => {
  row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    if (colNumber !== 1) {
      const isNumber = typeof cell.value === 'number' || (!isNaN(Number(cell.value)) && cell.value !== '');
      if (isNumber) {
        cell.numFmt = '#,##0.00';
      }
    }
    cell.font = { size: 12 };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });
});

  const dhdr = detailsSheet.getRow(1);
  dhdr.height=22;
  dhdr.eachCell(c => {
    c.font = { bold: true,size: 12, color: { argb: textColor } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillColor } };
  });
 detailsSheet.columns.forEach(col => {
  let max = 0;
  if (typeof col.header === 'string') {
    max = col.header.length;
  }
  col.eachCell({ includeEmpty: true }, cell => {
    const raw = cell.value ?? '';            // null/undefined → ''
    const len = String(raw).length;          // coerce to string
    if (len > max) max = len;
  });
  col.width = Math.min(Math.max(max + 8, 10), 50); // min 10, max 50
});


/**  Summary Sheet */
  const summarySheet  = wb.addWorksheet("Summary");

  const summaryHeaders = Object.keys(summaryList[0]);
  summarySheet.columns = summaryHeaders.map(h => ({
    header: h,
    key: h,
    width: Math.max(h.length, ...summaryHeaders.map(r => String(r[h] ?? '').length)) + 2,
    style: { alignment: { horizontal: 'center' } }
  }));

summaryList.forEach(row =>
  summarySheet.addRow(summaryHeaders.map(h => row[h] ?? ''))
              // .eachCell(c => c.alignment = { horizontal: 'center' })
);
summarySheet.eachRow((row, rowNumber) => {
  row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    if (colNumber !== 1) {
      const isNumber = typeof cell.value === 'number' || (!isNaN(Number(cell.value)) && cell.value !== '');
      if (isNumber) {
        cell.numFmt = '#,##0.00';
      }
    }
    cell.font = { size: 12 };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });
});

  const shdr = summarySheet.getRow(1);
  shdr.height = 22;
  shdr.eachCell(c => {
    c.font = { bold: true,size: 14, color: { argb: textColor } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillColor } };
  });
summarySheet.columns.forEach(col => {
  let max = 0;
  if (typeof col.header === 'string') {
    max = col.header.length;
  }
  col.eachCell({ includeEmpty: true }, cell => {
    const raw = cell.value ?? '';            // null/undefined → ''
    const len = String(raw).length;          // coerce to string
    if (len > max) max = len;
  });
  col.width = Math.min(Math.max(max + 8, 10), 50); // min 10, max 50
});



  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type:
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const link = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob),
    download: 'invoices.xlsx'
  });
  link.click();
  URL.revokeObjectURL(link.href);
}
async function buildReceipt(receipt: any){  
const flatInv = receipt.receipt;
const docType = flatInv.documentType.receiptTypeNameAr;
let T1:number=0,T4:number =0;

//#region  header
    // Build main header object
    const header: any = {};
    if(cfg['uuid'])
    {
      header['الرقم الالكتروني'] = flatInv['uuid'] ?? '';
      headersHead.add('الرقم الالكتروني');
    }
    if(cfg['documentTypeNameAr'])
    {
      header['نوع المستند'] = docType ?? '';
headersHead.add('نوع المستند');
    }

    header['نسخة المستند'] = flatInv.documentType.typeVersion;
    headersHead.add('نسخة المستند')
    header['حالة المستند'] = flatInv.status;
    headersHead.add('حالة المستند')
    header['تاريخ الاصدار'] = toExcelShortDate(flatInv.dateTimeIssued);    
    headersHead.add('تاريخ الاصدار')
    header['تاريخ التقديم'] = toExcelShortDate(flatInv.dateTimeReceived);
    headersHead.add('تاريخ التقديم')
    header['الرقم الداخلي'] = flatInv.receiptNumber;
    headersHead.add('الرقم الداخلي')
    header['العملة'] = flatInv.currency;
    headersHead.add('العملة')
    const rate=flatInv.exchangeRate;
    const totalSales=flatInv.totalSales; // 5000 usd 
    const isForign:boolean =rate !=0;
    if(isForign){
      header['معامل العملة'] = rate;
      headersHead.add('معامل العملة');
      header['totalSales(fc)'] = totalSales;
      headersHead.add('totalSales(fc)');
      header['قيمة الفاتورة'] = totalSales*rate;
      headersHead.add('قيمة الفاتورة');
      header['الخصم'] = flatInv.totalCommercialDiscount *rate;
      headersHead.add('الخصم');
      header['الاجمالي بعد الخصم'] = flatInv.netAmount*rate;
      headersHead.add('الاجمالي بعد الخصم');

    } else{
      header['قيمة الفاتورة'] = totalSales;
      headersHead.add('قيمة الفاتورة');
          header['الخصم'] = flatInv.totalCommercialDiscount ;
          headersHead.add('الخصم');
          header['الاجمالي بعد الخصم'] = flatInv.netAmount;
          headersHead.add('الاجمالي بعد الخصم');
    }

   // Flatten tax totals
    (flatInv.taxTotals || []).forEach((tax: any) => {
      if(tax.taxType=='T1'){
        if(isForign){
          header['ضريبه القيمه المضافه بالعمله'] = tax.amount;
        taxes.add('ضريبه القيمه المضافه بالعمله');
        }
        T1=isForign? tax.amount*rate:tax.amount;
        header['ضريبه القيمه المضافه'] = isForign? tax.amount*rate:tax.amount;
        taxes.add('ضريبه القيمه المضافه');
      }
      else if(tax.taxType=='T2'){
        header['ضريبه الجدول (نسبيه)'] = isForign?tax.amount*rate:tax.amount;
taxes.add('ضريبه الجدول (نسبيه)');

      }
      else if(tax.taxType=='T3'){
        header['ضريبه الجدول (النوعية)'] = isForign?tax.amount*rate:tax.amount;
taxes.add('ضريبه الجدول (النوعية)');

      }
      else if(tax.taxType=='T4'){
        T4 = isForign? tax.amount*rate:tax.amount;;
        header['الخصم تحت حساب الضريبه'] = isForign?tax.amount*rate:tax.amount;
taxes.add('الخصم تحت حساب الضريبه');

      }
      else if(tax.taxType=='T5'){
        header['ضريبه الدمغه (نسبيه)'] = isForign?tax.amount*rate:tax.amount;
taxes.add('ضريبه الدمغه (نسبيه)');

      }
      else if(tax.taxType=='T6'){
        header['ضريبه الدمغه (قطعيه بمقدار ثابت)'] = isForign?tax.amount*rate:tax.amount;
taxes.add('ضريبه الدمغه (قطعيه بمقدار ثابت)');

      }
      else if(tax.taxType=='T7'){
        header['ضريبة الملاهى'] = isForign?tax.amount*rate:tax.amount;
taxes.add('ضريبة الملاهى');

      }
      else if(tax.taxType=='T8'){
        header['رسم تنميه الموارد'] = isForign?tax.amount*rate:tax.amount;
taxes.add('رسم تنميه الموارد');

      }
      else if(tax.taxType=='T9'){
        header['رسم خدمة'] = isForign?tax.amount*rate:tax.amount;
taxes.add('رسم خدمة');

      }
      else if(tax.taxType=='T10'){
        header['رسم المحليات'] = isForign?tax.amount*rate:tax.amount;
taxes.add('رسم المحليات');

      }
      else if(tax.taxType=='T11'){
        header['رسم التامين الصحى'] = isForign?tax.amount*rate:tax.amount;
taxes.add('رسم التامين الصحى');

      }
      else{
        header['رسوم أخرى'] = isForign?tax.amount*rate:tax.amount;
taxes.add('رسوم أخرى');

      }

    });



     if(isForign){
          header['خصم اضافي علي الفاتورة'] = flatInv.extraReceiptDiscount[0]?.amount ?? 0 *rate;
    headersHead.add('خصم اضافي علي الفاتورة');
    header['اجمالي الفاتورة'] = flatInv.totalAmount*rate;
    headersHead.add('اجمالي الفاتورة');
    header['اجمالي الايصال بالعمله'] = flatInv.totalAmount;
    headersHead.add('اجمالي الايصال بالعمله');
    }else{
                header['خصم اضافي علي الفاتورة'] = flatInv.extraReceiptDiscount[0]?.amount ?? 0 ;
    headersHead.add('خصم اضافي علي الفاتورة');
    header['اجمالي الفاتورة'] = flatInv.totalAmount;
    headersHead.add('اجمالي الفاتورة');
    }
   

    if(cfg['submitterId'])
    {
      header['الرقم الضريبي للبائع'] = flatInv.seller.sellerId ?? '';
headersHead.add('الرقم الضريبي للبائع');
    }
if(cfg['submitterName'])
{
  header['اسم البائع'] = flatInv.seller.sellerName ?? '';
headersHead.add('اسم البائع');
}
if(cfg['submitterAndReceiverAddress'] ){
  headersHead.add('عنوان البائع');
  if(flatInv.seller.sellerId === taxpayerRIN)
  header['عنوان البائع'] = taxpayerAddress;
else
  header['عنوان البائع'] = await fetchAddressAPI(flatInv.seller.sellerId)??"";
}

if(cfg['recipientId'])
{
  header['الرقم الضريبي للمشتري'] = flatInv.buyer.buyerId ?? '';
headersHead.add('الرقم الضريبي للمشتري');
}
if(cfg['recipientName'])
{
  header['اسم المشتري'] = flatInv.buyer.buyerName ?? '';
headersHead.add('اسم المشتري');
}

  if(cfg['submitterAndReceiverAddress']) {
      header['مرجع طلب البيع'] = flatInv.sOrderNameCode ?? '';
headersHead.add('مرجع طلب البيع');
  }
 

//#endregion

//////////////////
//#region details

   for (const item of flatInv.itemData || []) {

      const row: any = { };
      row['الرقم الالكتروني']= flatInv.uuid;
      detailsHead.add('الرقم الالكتروني');
      row['نوع المستند']= docType;
      detailsHead.add('نوع المستند');
      row['تاريخ الاصدار']= toExcelShortDate(flatInv.dateTimeIssued);
      detailsHead.add('تاريخ الاصدار');
      row['الرقم الداخلي']= flatInv.receiptNumber;
      detailsHead.add('الرقم الداخلي');

      row['نوع الصنف']= item.itemType;
      detailsHead.add('نوع الصنف');
      row['كود الصنف']= item.itemCode;
      detailsHead.add('كود الصنف');
      row['اسم الصنف'] =item.itemCodeNameAr;
      detailsHead.add('اسم الصنف');
      row['وصف الصنف'] =item.description;
      detailsHead.add('وصف الصنف');
      row['كود الوحدة']= item.unitType;
      detailsHead.add('كود الوحدة');
      row['الكمية'] = item.quantity;
      detailsHead.add('الكمية');
      if(rate !==0){
            row['العمله'] = rate;
      detailsHead.add('العمله'); 
      }
      row['سعر الوحدة'] = isForign ?item.unitPrice*rate:item.unitPrice;
      detailsHead.add('سعر الوحدة');  
        row['القيمة'] = isForign? item.totalSale*rate: item.totalSale;
        detailsHead.add('القيمة');
        row['الخصم'] = isForign? item.commercialDiscount[0]?.amount??0*rate : item.commercialDiscount[0]?.amount??0;
        detailsHead.add('الخصم');
        row['الاجمالي بعد الخصم'] = isForign? item.netSale*rate:item.netSale;
        detailsHead.add('الاجمالي بعد الخصم');
      
        (item.taxableItems || []).forEach((tax: any) => {
             if(tax.taxType=='T1')
        row['ضريبه القيمه المضافه'] = isForign? tax.amount*rate:tax.amount;
      if(tax.taxType=='T2')
        row['ضريبه الجدول (نسبيه)'] = isForign? tax.amount*rate:tax.amount;
      if(tax.taxType=='T3')
        row['ضريبه الجدول (النوعية)'] = isForign? tax.amount*rate:tax.amount;
      if(tax.taxType=='T4')
        row['الخصم تحت حساب الضريبه'] = isForign? tax.amount*rate:tax.amount;
      if(tax.taxType=='T5')
        row['ضريبه الدمغه (نسبيه)'] = isForign? tax.amount*rate:tax.amount;
      if(tax.taxType=='T6')
        row['ضريبه الدمغه (قطعيه بمقدار ثابت)'] = isForign? tax.amount*rate:tax.amount;
      if(tax.taxType=='T7')
        row['ضريبة الملاهى'] = isForign? tax.amount*rate:tax.amount;
      if(tax.taxType=='T8')
        row['رسم تنميه الموارد'] = isForign? tax.amount*rate:tax.amount;
      if(tax.taxType=='T9')
        row['رسم خدمة'] = isForign? tax.amount*rate:tax.amount;
      if(tax.taxType=='T10')
        row['رسم المحليات'] = isForign? tax.amount*rate:tax.amount;
      if(tax.taxType=='T11')
        row['رسم التامين الصحى'] = isForign? tax.amount*rate:tax.amount;
      if(tax.taxType=='T12')
        row['رسوم أخرى'] = isForign? tax.amount*rate:tax.amount;
      });

        row['الاجمالي'] = isForign?item.total*rate:item.total;
        detailsHead.add('الاجمالي');
       

      detailsList.push(row);
    }
    headersList.push(header);
    
    
    //#endregion


    //handle summery
let typeSummary  =summaryList.find(x=>x['نوع المستند'] == docType)
if(!typeSummary){
  const typeSummary={}
  typeSummary['نوع المستند']=docType;
  typeSummary['العدد']=1;
  typeSummary['totalNetAmount']=isForign ?flatInv.netAmount*rate:flatInv.netAmount;
  typeSummary['ضريبه القيمه المضافه']=T1;
  typeSummary['الخصم تحت حساب الضريبه']=T4;
  typeSummary['totalinvoiceAmount']=isForign?flatInv.totalAmount*rate:flatInv.totalAmount;
  summaryList.push(typeSummary);
}
else{
  typeSummary['العدد']++;
  typeSummary['totalNetAmount']+=isForign ?flatInv.netAmount*rate:flatInv.netAmount;;
  typeSummary['ضريبه القيمه المضافه']+=T1;
  typeSummary['الخصم تحت حساب الضريبه']+=T4;
  typeSummary['totalinvoiceAmount']+=isForign? flatInv.totalAmount*rate : flatInv.totalAmount;
}

}
async function buildInvoice(invoice: any){  
  const flatInv = invoice;
const docType = flatInv.documentTypeNameSecondaryLang;
let T1:number=0,T4:number =0;

//#region  header
    // Build main header object
    const header: any = {};
    if(cfg['uuid'])
    {
      header['الرقم الالكتروني'] = flatInv['uuid'] ?? '';
      headersHead.add('الرقم الالكتروني');
    }
    if(cfg['documentTypeNameAr'])
    {
      header['نوع المستند'] = flatInv['documentTypeNameSecondaryLang'] ?? '';
headersHead.add('نوع المستند');
    }

    header['نسخة المستند'] = flatInv.documentTypeVersion;
    headersHead.add('نسخة المستند')
    header['حالة المستند'] = flatInv.status;
    headersHead.add('حالة المستند')
    header['تاريخ الاصدار'] = toExcelShortDate(flatInv.dateTimeIssued);    
    headersHead.add('تاريخ الاصدار')
    header['تاريخ التقديم'] = toExcelShortDate(flatInv.dateTimeRecevied);
    headersHead.add('تاريخ التقديم')
    header['الرقم الداخلي'] = flatInv.internalID;
    headersHead.add('الرقم الداخلي')
    header['العملة'] = flatInv.currencySegments[0].currency;
    headersHead.add('العملة')
    const isForign:boolean=flatInv.currenciesSold =='Foreign';
    const rate=flatInv.currencySegments[0].currencyExchangeRate;
    const totalSalesFC=flatInv.currencySegments[0].totalSales;
    if(isForign){
      header['معامل العملة'] = rate;
      headersHead.add('معامل العملة');
      header['totalSales(fc)'] = totalSalesFC;
      headersHead.add('totalSales(fc)');
    } 
    header['قيمة الفاتورة'] = flatInv.netAmount;
    headersHead.add('قيمة الفاتورة');
    header['الخصم'] = flatInv.totalDiscount;
    headersHead.add('الخصم');
    header['الاجمالي بعد الخصم'] = flatInv.netAmount;
    headersHead.add('الاجمالي بعد الخصم');


   // Flatten tax totals
    (flatInv.taxTotals || []).forEach((tax: any) => {
      if(tax.taxType=='T1'){
        if(isForign){
            header['ضريبه القيمه المضافه بالعمله'] = tax.amount/rate;
taxes.add('ضريبه القيمه المضافه بالعمله');
        }
        T1=tax.amount;
        header['ضريبه القيمه المضافه'] = tax.amount ?? '';
taxes.add('ضريبه القيمه المضافه');
      }
      else if(tax.taxType=='T2'){
        header['ضريبه الجدول (نسبيه)'] = tax.amount ?? '';
taxes.add('ضريبه الجدول (نسبيه)');

      }
      else if(tax.taxType=='T3'){
        header['ضريبه الجدول (النوعية)'] = tax.amount ?? '';
taxes.add('ضريبه الجدول (النوعية)');

      }
      else if(tax.taxType=='T4'){
        T4=tax.amount;
        header['الخصم تحت حساب الضريبه'] = tax.amount ?? '';
taxes.add('الخصم تحت حساب الضريبه');

      }
      else if(tax.taxType=='T5'){
        header['ضريبه الدمغه (نسبيه)'] = tax.amount ?? '';
taxes.add('ضريبه الدمغه (نسبيه)');

      }
      else if(tax.taxType=='T6'){
        header['ضريبه الدمغه (قطعيه بمقدار ثابت)'] = tax.amount ?? '';
taxes.add('ضريبه الدمغه (قطعيه بمقدار ثابت)');

      }
      else if(tax.taxType=='T7'){
        header['ضريبة الملاهى'] = tax.amount ?? '';
taxes.add('ضريبة الملاهى');

      }
      else if(tax.taxType=='T8'){
        header['رسم تنميه الموارد'] = tax.amount ?? '';
taxes.add('رسم تنميه الموارد');

      }
      else if(tax.taxType=='T9'){
        header['رسم خدمة'] = tax.amount ?? '';
taxes.add('رسم خدمة');

      }
      else if(tax.taxType=='T10'){
        header['رسم المحليات'] = tax.amount ?? '';
taxes.add('رسم المحليات');

      }
      else if(tax.taxType=='T11'){
        header['رسم التامين الصحى'] = tax.amount ?? '';
taxes.add('رسم التامين الصحى');

      }
      else{
        header['رسوم أخرى'] = tax.amount ?? '';
taxes.add('رسوم أخرى');

      }

    });

    
    header['خصم اضافي علي الفاتورة'] = flatInv.extraDiscountAmount;
    headersHead.add('خصم اضافي علي الفاتورة');
    header['اجمالي الفاتورة'] = flatInv.totalAmount;
    headersHead.add('اجمالي الفاتورة');
    if(isForign){
        header['اجمالي الفاتورة بالعمله'] = flatInv.currencySegments[0].totalAmount;
    headersHead.add('اجمالي الفاتورة بالعمله');
    }

    if(cfg['submitterId'])
    {
      header['الرقم الضريبي للبائع'] = flatInv.issuer.id ?? '';
headersHead.add('الرقم الضريبي للبائع');
    }
if(cfg['submitterName'])
{
  header['اسم البائع'] = flatInv.issuer.name ?? '';
headersHead.add('اسم البائع');
}
if(cfg['submitterAndReceiverAddress'] ){
  headersHead.add('عنوان البائع');
  if(flatInv.issuer.id === taxpayerRIN)
  header['عنوان البائع'] = taxpayerAddress;
else
  header['عنوان البائع'] = await fetchAddressAPI(flatInv.issuer.id)??"";
}

if(cfg['recipientId'])
{
  header['الرقم الضريبي للمشتري'] = flatInv.receiver.id ?? '';
headersHead.add('الرقم الضريبي للمشتري');
}
if(cfg['recipientName'])
{
  header['اسم المشتري'] = flatInv.receiver.name ?? '';
headersHead.add('اسم المشتري');
}
if(cfg['submitterAndReceiverAddress'] ){
  headersHead.add('عنوان المشتري');
  if(flatInv.receiver.id !== taxpayerRIN)
     header['عنوان المشتري'] = await fetchAddressAPI(flatInv.receiver.id)??"";
  else
    header['عنوان المشتري'] = taxpayerAddress;
  }
  if(cfg['submitterAndReceiverAddress']) {
      header['مرجع طلب الشراء'] = flatInv.purchaseOrderReference ?? '';
      headersHead.add('مرجع طلب الشراء');
      header['مرجع طلب البيع'] = flatInv.salesOrderReference ?? '';
headersHead.add('مرجع طلب البيع');
  }
 

//#endregion

//////////////////
//#region details

   for (const item of flatInv.invoiceLines || []) {
      const unit = item.unitValue || {};

      const row: any = { };
      row['الرقم الالكتروني']= flatInv.uuid;
      detailsHead.add('الرقم الالكتروني');
      row['نوع المستند']= flatInv.documentTypeNameSecondaryLang;
      detailsHead.add('نوع المستند');
      row['تاريخ الاصدار']= toExcelShortDate(flatInv.dateTimeIssued);
      detailsHead.add('تاريخ الاصدار');
      row['الرقم الداخلي']= flatInv.internalID;
      detailsHead.add('الرقم الداخلي');

      row['نوع الصنف']= item.itemType;
      detailsHead.add('نوع الصنف');
      row['كود الصنف']= item.itemCode;
      detailsHead.add('كود الصنف');
      row['اسم الصنف'] =item.itemSecondaryName;
      detailsHead.add('اسم الصنف');
      row['وصف الصنف'] =item.description;
      detailsHead.add('وصف الصنف');
      row['كود الوحدة']= item.unitType;
      detailsHead.add('كود الوحدة');
      row['الكمية'] = item.quantity;
      detailsHead.add('الكمية');  
      row['سعر الوحدة'] = unit.amountEGP;
      detailsHead.add('سعر الوحدة');  
        row['القيمة'] = item.salesTotal;
        detailsHead.add('القيمة');
        row['الخصم'] = item.itemsDiscount;
        detailsHead.add('الخصم');
        row['الاجمالي بعد الخصم'] = item.netTotal;
        detailsHead.add('الاجمالي بعد الخصم');
      
        (item.lineTaxableItems || []).forEach((tax: any) => {
             if(tax.taxType=='T1')
        row['ضريبه القيمه المضافه'] = tax.amount ?? '';
      if(tax.taxType=='T2')
        row['ضريبه الجدول (نسبيه)'] = tax.amount ?? '';
      if(tax.taxType=='T3')
        row['ضريبه الجدول (النوعية)'] = tax.amount ?? '';
      if(tax.taxType=='T4')
        row['الخصم تحت حساب الضريبه'] = tax.amount ?? '';
      if(tax.taxType=='T5')
        row['ضريبه الدمغه (نسبيه)'] = tax.amount ?? '';
      if(tax.taxType=='T6')
        row['ضريبه الدمغه (قطعيه بمقدار ثابت)'] = tax.amount ?? '';
      if(tax.taxType=='T7')
        row['ضريبة الملاهى'] = tax.amount ?? '';
      if(tax.taxType=='T8')
        row['رسم تنميه الموارد'] = tax.amount ?? '';
      if(tax.taxType=='T9')
        row['رسم خدمة'] = tax.amount ?? '';
      if(tax.taxType=='T10')
        row['رسم المحليات'] = tax.amount ?? '';
      if(tax.taxType=='T11')
        row['رسم التامين الصحى'] = tax.amount ?? '';
      if(tax.taxType=='T12')
        row['رسوم أخرى'] = tax.amount ?? '';
      });

        row['الاجمالي'] = item.total;
        detailsHead.add('الاجمالي');
       

      detailsList.push(row);
    }
    headersList.push(header);
    
    
    //#endregion


    //handle summery
let typeSummary  =summaryList.find(x=>x['نوع المستند'] == docType)
if(!typeSummary){
  const typeSummary={}
  typeSummary['نوع المستند']=docType;
  typeSummary['العدد']=1;
  typeSummary['totalNetAmount']=flatInv.netAmount;
  typeSummary['ضريبه القيمه المضافه']=T1;
  typeSummary['الخصم تحت حساب الضريبه']=T4;
  typeSummary['totalinvoiceAmount']=flatInv.totalAmount;
  summaryList.push(typeSummary);
}
else{
  typeSummary['العدد']++;
  typeSummary['totalNetAmount']+=flatInv.netAmount;
  typeSummary['ضريبه القيمه المضافه']+=T1;
  typeSummary['الخصم تحت حساب الضريبه']+=T4;
  typeSummary['totalinvoiceAmount']+=flatInv.totalAmount;
}

}

async function getHeaders(heads:Set<string>,taxs:Set<string>){
const headers:string[] =[];
  for (const element of heads) {
    headers.push(element)
    if(element=='الاجمالي بعد الخصم'){
      const taxesArray = Array.from(taxes);

// Sort taxes: known ones first (by priority), then unknown ones alphabetically
const sortedTaxes = taxesArray.sort((a, b) => {
  const indexA = taxPriority.indexOf(a);
  const indexB = taxPriority.indexOf(b);

  const isAInPriority = indexA !== -1;
  const isBInPriority = indexB !== -1;

  if (isAInPriority && isBInPriority) {
    return indexA - indexB; // sort by defined order
  }

  if (isAInPriority) return -1; // a comes before b
  if (isBInPriority) return 1;  // b comes before a

  // If both are not in the priority list, sort alphabetically
  return a.localeCompare(b, 'ar'); // Use 'ar' locale for Arabic
});

      for(const tax of taxesArray){
        headers.push(tax);
      }
    }
  }
  return headers;

}

function toExcelShortDate(isoDateStr?: string | null): string {
  if (!isoDateStr) return "";

  const date = new Date(isoDateStr);
  if (isNaN(date.getTime())) return "";

  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0'); // months are 0-based
  const yyyy = date.getFullYear();

  return `${dd}/${mm}/${yyyy}`;
}
function collectSelectedFields(): Set<string> {
  const modal = getModalEl();
  const set   = new Set<string>();

  const boxes = modal.querySelectorAll<HTMLInputElement>(
    "input[type='checkbox'][data-field]"
  );
  boxes.forEach(cb => {
    if (cb.checked && cb.dataset.field) set.add(cb.dataset.field);
  });
  return set;
}
function buildConfigFromSelection(selected: Set<string>) {
  return {
    uuid:               selected.has("uuid"),
    documentTypeNameAr:       selected.has("documentTypeNameAr"),
    submitterId : selected.has("submitterId"),
submitterName : selected.has("submitterName"),
recipientId : selected.has("ReceiverTaxNumber"),
recipientName : selected.has("recipientName"),
submitterAndReceiverAddress : selected.has("submitterAndReceiverAddress"),
PORSOR : selected.has("PORSOR"),
    }
  };
function ensureArgb(hexColor: string): string {
  hexColor = hexColor.replace('#', '').toUpperCase();
  return hexColor.length === 6 ? 'FF' + hexColor : hexColor;
}

//#endregion

//////////////////////////////////////////////////////
//#region  global Functions 
//#region  modal
function ensureModal(type: "invoice" | "receipt") {
  // Remove both modals if they’re already in the DOM
  document.getElementById("eta-bootstrap-modal")?.remove();
  document.getElementById("eta-bootstrap-receipt-modal")?.remove();

  // Inject the requested one
  document.body.insertAdjacentHTML("beforeend", modalTemplates[type]);
}
function openModalById(id: string) {
  $(`#${id}`).modal({ backdrop: 'static', keyboard: true })
  $(`#${id}`).modal('show')
}

//#endregion

function getModalEl(): HTMLElement {
  const el = document.getElementById("eta-bootstrap-modal");
  if (!el) throw new Error("Modal element not found");
  return el;
}
async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
async function updateCount(count: number) {
  const total = uuidsList.length;
  const el = document.getElementById('docCount');
  if (el) {
    el.innerText = `تحت المعالجة ${count} / ${total} (${Math.round(count / total * 100)}%)`;
  }
}


function injectSpinner() {
  if (document.getElementById('eta-spinner')) return;

  const wrap = document.createElement('div');
  wrap.id = 'eta-spinner';
  wrap.style.cssText =
    'position:fixed;inset:0;display:none;align-items:center;justify-content:center;' +
    'flex-direction:column;background:rgba(0,0,0,.35);z-index:200000;gap:1rem;color:white;font-size:1.25rem;';
  
  wrap.innerHTML = `
    <div class="spinner-border text-light" role="status"></div>
    
  `;

  document.body.appendChild(wrap);
}

function showSpinner(show: boolean) {
  document.getElementById('eta-spinner')!.style.display = show ? 'flex' : 'none';
}
function loadTooltip(){
  const tooltipTriggerList = document.querySelectorAll('[data-toggle="tooltip"]');
  
  tooltipTriggerList.forEach((tooltipTriggerEl) => {
    new bootstrap.Tooltip(tooltipTriggerEl);
  });
}
//#endregion

//#region  fetching from portal

async function fetchUUIDs() {  
  uuidsList = [];
  headersHead = new Set<string>();
  detailsHead = new Set<string>();
  taxes = new Set<string>();
  headersList = [];
  detailsList = [];
  summaryList = [];

  const seenUUIDs = new Set<string>();  // 👈 Track UUIDs to prevent duplicates

  const url = new URL(lastCallURL);
  
  const basePath = url.origin + url.pathname;
  const params = url.searchParams;

  params.set("PageSize", "100");
  let page = 1;
let totalPages = Math.ceil(responseTotalCount / 100);
  const isRecent = basePath.includes("/recent");
  const isSearch = basePath.includes("/search");
  const isInvoices = basePath.includes("/documents");
  const isReceipts = basePath.includes("/receipts");

do {
  if (isInvoices)
    params.set("Page", String(page));
  else
    params.set("PageNo", String(page));

  const pageUrl = `${basePath}?${params.toString()}`;
  // lastSearchedURL = pageUrl;

  const res = await fetch(pageUrl, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${user_token}`
    }
  });

  if (!res.ok) throw new Error(`ETA API ${res.status}`);
  const json = await res.json();

  if (isInvoices) {
    const result = json.result;

    for (const inv of result) {
      const uuid = isRecent ? inv.uuid : inv.source.uuid;
      const internalId = isRecent ? inv.internalId : inv.source.internalId;
      const docType = isRecent ? inv.documentTypeNameSecondaryLang : inv.source.documentTypeNameSecondaryLang;

      if (!seenUUIDs.has(uuid)) {
        seenUUIDs.add(uuid);

        const partyName = isRecent
          ? (inv.issuerId === taxpayerRIN ? inv.receiverName : inv.issuerName)
          : (inv.source.submitterId === taxpayerRIN ? inv.source.recipientName : inv.source.submitterName);

        uuidsList.push({ uuid, partyName, docType, internalId });
      }
    }
  }

  if (isReceipts) {
    const result = json.receipts;

    for (const inv of result) {
      if (!seenUUIDs.has(inv.uuid)) {
        seenUUIDs.add(inv.uuid);

        const partyName = inv.issuerId === taxpayerRIN ? inv.receiverName : inv.issuerName;
        uuidsList.push({ uuid: inv.uuid, partyName });
      }
    }
  }

  page++;
} while (page<=totalPages);

}
async function fetchDetails(dir = "documents") {
  let index=0
  for (const meta of uuidsList) {
    try {
      const result = await getDocumentDetails(meta.uuid, dir);
      
      if (result) {
                
        if (dir === "documents") {
          await buildInvoice(result);
          index++;
await updateCount(index);
        } else {
          await buildReceipt(result);
          index++;
          await updateCount(index);
        }
      }
    } catch (error) {
      console.warn(`Error fetching details for UUID ${meta.uuid}`, error);
    }

    // Optional: Wait 500ms between each request
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
}
async function getDocumentDetails(uuid: string, dir: string = "documents", retries: number = 0): Promise<any> {
  const url = `${API}/${dir}/${uuid}/details`;
  if(dir=="documents")
url+"?documentLinesLimit=1000"
  return new Promise((resolve) => {
    $.ajax({
      url: url,
      method: "GET",
      timeout: 5e3,
      cache: false,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${user_token}`,
        "Accept-Language": localStorage.i18nextLng || "ar"
      },
      success: function (data) {
        resolve(data);
      },
      error: async function (xhr, status, error) {
        console.warn(`Failed to fetch invoice ${uuid} (attempt ${retries + 1}):`, status, error);

        if ((status === 'timeout' || status === 'error' || status === 'canceled') && retries < 2)
 {
          // Retry only if request was canceled
          const retryResult = await getDocumentDetails(uuid, dir, retries + 1);
          resolve(retryResult);
        } else {
          // For any other failure or max retries reached
          resolve(null);
        }
      }
    });
  });
}
async function fetchAddressAPI(taxNumber){
   if (!taxNumber) return "";   
    try {
 const url = `${API}/taxpayers/${taxNumber}/light`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${user_token}`
      }
    });

    if (!res.ok) throw new Error(`Address API returned HTTP ${res.status}`);

    const json = await res.json();
let address =json.taxpayerBranchs[0].sourceAddress;
    return address??'';
  } catch (err) {
    console.error("Could not load Address", err);
    return '';
  }
}
async function fetchAddress() {
  const cached = localStorage.getItem('taxpayerAddress');
  const taxNumber = localStorage.getItem('RIN');
  if (cached) {
    taxpayerAddress = cached;
    return;
  }

  // B) else hit the API
taxpayerAddress=await fetchAddressAPI(taxNumber);
 localStorage.setItem('taxpayerAddress', JSON.stringify(taxpayerAddress));
    return;
}
//#endregion

///////////////////////////////////////////////////////
const modalTemplates: Record<"invoice" | "receipt", string> = {
  invoice: `
  <div class="modal fade" id="eta-bootstrap-modal" tabindex="1" aria-labelledby="modalTitle" aria-hidden="true">
    <div class="modal-dialog modal-dialog-scrollable">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title" id="modalTitle">Exporting to excel.</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div class="modal-body">
        <p class="text-muted">This extension is powerd by <a target="_blank" href="https://b-ecosystems.com/">Business EcoSystems</a></p>
          <!-- your checkboxes go here -->
                  <div class="flex align-items-stretch">
  <div class="m-2 w-25">
  <label for="headerColor" class="form-label">Header color</label>
    <input type="color" id="headerColor" value="#0078d4" class="form-control form-control-color w-100">
</div>
  <div class="m-2 w-25">
  <label for="headerTextColor" class="form-label">Header Text</label>
    <input type="color" id="headerTextColor" value="#000000" class="form-control form-control-color w-100">
</div>
  <div class="aligncenter m-2">
  <span id="docCount" class="text-success fw-bolder border m-2">عدد المستندات : </span>

</div>
</div>

          
          <fieldset class="text-end">
            <legend>اعمدة ملف الاكسيل </legend>
            <label>الرقم الالكتروني <input type="checkbox" data-field="uuid" checked></label><br/>
            <label>نوع المستند <input type="checkbox" data-field="documentTypeNameAr" checked></label><br/>
            <label>اسم البائع <input type="checkbox" data-field="submitterName" checked></label><br/>
            <label>رقم التسجيل الضريبي للبائع <input type="checkbox" data-field="submitterId" checked></label><br/>
            <label>اسم المشتري <input type="checkbox" data-field="recipientName" checked></label><br/>
            <label>رقم التسجيل الضريبي للمشتري<input type="checkbox" data-field="ReceiverTaxNumber" checked></label><br/>
            <label>عنوان البائع والمشتري <input type="checkbox" data-field="submitterAndReceiverAddress"></label><br/>
            <label>مرجع طلب الشراء والبيع <input type="checkbox" data-field="PORSOR"></label><br/>
            <!-- more... -->
          </fieldset>
        </div>
        <div class="modal-footer flex-column align-items-stretch">
  <div class="text-center">
  <button type="button" class="btn btn-primary w-25 mb-2 " id="downloadExcelBtn">تنزيل اكسيل</button>
  <button type="button" class="btn btn-primary w-25 mb-2 " id="downloadPDFBtn">تنزيل PDF</button>
  <button type="button" class="btn btn-primary w-25 mb-2 " data-toggle="tooltip" data-placement="top" title="قريبا ">تنزيل نموذج 10 </button>
  </div>
  <div class="text-start">
    <strong>Contact us:</strong>
    <p>Email: <a href="mailto:info@b-ecosystems.com">info@b-ecosystems.com</a><br/>
    Phone: +201002474602</p>
  </div>
  <p class="text-center mt-2 text-muted">© 2025 <a target="_blank" href="https://b-ecosystems.com/">Business EcoSystems.</a>  All rights reserved.</p>
</div>

      </div>
    </div>
  </div>`,
   receipt:`
  <div class="modal fade" id="eta-bootstrap-receipt-modal" tabindex="1" aria-labelledby="modalTitle" aria-hidden="true">
    <div class="modal-dialog modal-dialog-scrollable">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title" id="modalTitle">Exporting to excel.</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div class="modal-body">
        <p class="text-muted">This extension is powerd by <a target="_blank" href="https://b-ecosystems.com/">Business EcoSystems</a></p>
          <!-- your checkboxes go here -->
<h3 class="text-info"> Comming Soon...!</h3>
        </div>
        <div class="modal-footer flex-column align-items-stretch">
  <div class="mt-3 text-start">
    <strong>Contact us:</strong>
    <p>Email: <a href="mailto:info@b-ecosystems.com">info@b-ecosystems.com</a><br/>
    Phone: +201002474602</p>
  </div>
  <p class="text-center mt-2 text-muted">© 2025 <a target="_blank" href="https://b-ecosystems.com/">Business EcoSystems.</a>  All rights reserved.</p>
</div>

      </div>
    </div>
  </div>`
};