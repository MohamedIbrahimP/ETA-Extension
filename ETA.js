var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
let API = `https://api-portal.invoicing.eta.gov.eg/api/v1`;
let invoiceHref = `https://invoicing.eta.gov.eg/documents`;
let receiptHref = `https://invoicing.eta.gov.eg/documents`;
let currentPage = ``;
let logoUrl = ``;
let lastCallURL = ``;
let user_token = ``;
let responseTotalCount = 0;
let taxpayerAddress = "";
let taxpayerRIN = "";
let cfg;
const DEFAULT_OPTIONS = {
    documentTypeNameAr: true,
    submitterId: true,
    submitterName: true,
    recipientId: true,
    recipientName: true,
    submitterAndReceiverAddress: false,
    PORSOR: false,
    singleSheet: true,
    headerColor: "#0078d4",
    headerTextColor: "#000000"
};
const STORAGE_KEY = "eta_export_options";
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
let uuidsList = [];
let headersList = [];
let detailsList = [];
let summaryList = [];
let headersHead = new Set();
let detailsHead = new Set();
let taxes = new Set();
// -----------------------------------
// Hook XHR globally
(function () {
    if (window._xhrHooked)
        return;
    window._xhrHooked = true;
    const OriginalXHR = window.XMLHttpRequest;
    class CustomXHR extends OriginalXHR {
        constructor() {
            super();
            this.addEventListener("readystatechange", function () {
                return __awaiter(this, void 0, void 0, function* () {
                    var _a, _b;
                    if (this.readyState !== 4 || this.status !== 200)
                        return;
                    // is this a /documents/search call?
                    const invoicesUri = `${API}/documents`;
                    const receiptsUri = `${API}/receipts`;
                    // if (!this.responseURL.startsWith(`${invoicesUri}`) && !this.responseURL.startsWith(`${receiptsUri}`)) return;
                    if (!this.responseURL.includes(`/recent`) && !this.responseURL.includes(`/search`))
                        return;
                    // 2‑a) parse response
                    const resp = JSON.parse(this.responseText);
                    responseTotalCount = (_b = (_a = resp.metadata) === null || _a === void 0 ? void 0 : _a.totalCount) !== null && _b !== void 0 ? _b : 0;
                    lastCallURL = this.responseURL;
                });
            });
        }
    }
    // replace the browser's XHR with our subclass
    window.XMLHttpRequest = CustomXHR;
})();
// DOM injection logic
window.addEventListener('load', () => {
    extension();
});
window.addEventListener("message", (event) => {
    if (event.source !== window)
        return; // only same-window messages
    const msg = event.data;
    if (!msg || msg.source !== "ETA_EXTENSION_BRIDGE")
        return;
    const { besIcon } = msg.payload; // this is the chrome.runtime URL
    logoUrl = besIcon;
    console.log(logoUrl);
    console.log(msg.payload);
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
            var _a;
            currentPage = location.href;
            const USER_DATA = localStorage.getItem('USER_DATA');
            const parsed = JSON.parse(USER_DATA || '{}');
            user_token = parsed.access_token || '';
            taxpayerRIN = (_a = localStorage.getItem('RIN')) !== null && _a !== void 0 ? _a : '';
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
    if (!container || container.querySelector('#openModal'))
        return;
    const btn = document.createElement('button');
    btn.id = 'openModal';
    btn.textContent = `Export ${lable}`;
    btn.className = 'btn btn-primary ms-2';
    btn.onclick = () => __awaiter(this, void 0, void 0, function* () {
        if (currentPage.includes('invoices') || currentPage.includes('documents')) {
            ensureModal("invoice");
            openModalById("eta-bootstrap-modal");
            document.getElementById("docCount").textContent = `عدد المستندات : ${responseTotalCount}`;
            document.getElementById("downloadExcelBtn").addEventListener("click", () => __awaiter(this, void 0, void 0, function* () {
                yield handleDownloadExcel('documents');
            }));
            document.getElementById("downloadPDFBtn").addEventListener("click", () => __awaiter(this, void 0, void 0, function* () {
                yield handleDownloadPDF();
            }));
        }
        if (currentPage.includes('receipts')) {
            ensureModal("invoice");
            openModalById("eta-bootstrap-modal");
            document.getElementById("docCount").textContent = `عدد المستندات : ${responseTotalCount}`;
            document.getElementById("downloadExcelBtn").addEventListener("click", () => __awaiter(this, void 0, void 0, function* () {
                yield handleDownloadExcel('receipts');
            }));
        }
        loadTooltip();
    });
    container.appendChild(btn);
}
function handleDownloadPDF() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            showSpinner(true);
            updateCount(0); // Reset UI
            yield new Promise((r) => setTimeout(r, 50)); // Give browser time to paint spinner
            yield fetchUUIDs();
            yield exportInvoicesZip();
        }
        catch (err) {
            console.error("❌ Error during PDF download:", err);
            alert("حدث خطأ أثناء تحميل الفواتير. يرجى المحاولة مرة أخرى.");
        }
        finally {
            showSpinner(false);
            $('#eta-bootstrap-modal').modal('hide');
        }
    });
}
function exportInvoicesZip() {
    return __awaiter(this, arguments, void 0, function* (dir = "documents") {
        const zip = new JSZip();
        let downloaded = 0;
        for (const meta of uuidsList) {
            const blob = yield fetchPdf(meta.uuid, dir);
            if (blob) {
                const fileName = `(${meta.docType})_${slugify(meta.internalId)}_${slugify(meta.partyName)}.pdf`;
                zip.file(fileName, blob);
            }
            downloaded++;
            updateCount(downloaded); // 👈 Show progress to user
        }
        const zipBlob = yield zip.generateAsync({ type: "blob" });
        const link = Object.assign(document.createElement('a'), {
            href: URL.createObjectURL(zipBlob),
            download: 'invoices.zip'
        });
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(link.href);
    });
}
function fetchPdf(uuid_1) {
    return __awaiter(this, arguments, void 0, function* (uuid, dir = "documents", attempt = 1) {
        const url = `${API}/${dir}/${uuid}/pdf`;
        const token = JSON.parse(localStorage.USER_DATA).access_token;
        try {
            const blob = yield $.ajax({
                url: url,
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "accept-language": localStorage.i18nextLng || "ar"
                },
                xhrFields: {
                    responseType: "blob"
                }
            });
            return blob; // success
        }
        catch (error) {
            console.error(`Error fetching PDF (attempt ${attempt}) for UUID: ${uuid}`, error);
            if (attempt < 3) {
                console.warn(`Retrying fetchPdf (${attempt + 1}/3) for UUID: ${uuid}`);
                return fetchPdf(uuid, dir, attempt + 1); // 🔁 recursive retry
            }
            return null; // failed after 3 attempts
        }
    });
}
function slugify(text = '') {
    return text.replace(/[\/\\:*?"<>|]/g, '_').trim();
}
function handleDownloadExcel() {
    return __awaiter(this, arguments, void 0, function* (dir = "documents") {
        const opts = loadOptions();
        cfg = {
            singleSheet: opts.singleSheet,
            documentTypeNameAr: opts.documentTypeNameAr,
            submitterId: opts.submitterId,
            submitterName: opts.submitterName,
            recipientId: opts.recipientId,
            recipientName: opts.recipientName,
            submitterAndReceiverAddress: opts.submitterAndReceiverAddress,
            PORSOR: opts.PORSOR
        };
        const colourHex = opts.headerColor;
        const textColourHex = opts.headerTextColor;
        try {
            showSpinner(true);
            yield new Promise(r => setTimeout(r)); // give browser a chance to paint spinner
            yield fetchUUIDs();
            yield fetchDetails(dir);
            console.log(textColourHex);
            yield exportFilteredRowsExcelJS(colourHex, textColourHex);
        }
        finally {
            showSpinner(false);
            $('#eta-bootstrap-modal').modal('hide');
        }
    });
}
//#region  Excel functions 
function exportFilteredRowsExcelJS(headerHex, textColourHex) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!headersList.length) {
            alert("Please Select Valid Search Criteria!");
            return;
        }
        const fillColor = ensureArgb(headerHex);
        const textColor = ensureArgb(textColourHex);
        const wb = new ExcelJS.Workbook();
        /** ==== HEADERS SHEET (created first) ==== */
        const headersSheet = wb.addWorksheet("الفواتير");
        const headerKeys = yield getHeaders(headersHead, taxes); // e.g., ["internalId", "partyName", ...]
        const headers = ["ID", "View", ...headerKeys];
        headersSheet.columns = headers.map(h => ({
            header: h,
            key: h,
            style: { alignment: { horizontal: "center" } }
        }));
        // buffer header rows to fill after hyperlink resolution
        headersList.forEach((inv, index) => {
            const rowValues = [
                index + 1,
                "View",
                ...headerKeys.map(h => { var _a; return (_a = inv[h]) !== null && _a !== void 0 ? _a : ""; })
            ];
            headersSheet.addRow(rowValues).eachCell(c => (c.alignment = { horizontal: "center" }));
        });
        /** ==== DETAILS SHEET OR PER-INVOICE SHEETS ==== */
        const detailRowMap = {}; // maps invoiceId -> first row in details (shared) or first detail row in its own sheet
        const invoiceSheetNames = [];
        if (cfg.singleSheet) {
            // Shared Details sheet
            const detailsSheet = wb.addWorksheet("التفاصيل");
            const detailsHeaderKeys = yield getHeaders(detailsHead, taxes);
            const detailsHeader = ["ID", ...detailsHeaderKeys]; // assume UUID is second column for linking
            detailsSheet.columns = detailsHeader.map(h => ({
                header: h,
                key: h,
                style: { alignment: { horizontal: "center" } }
            }));
            let detailIndex = 0;
            for (const inv of headersList) {
                const uuid = inv['الرقم الالكتروني'];
                const invDetails = Array.isArray(inv.details) ? inv.details : [];
                for (const det of invDetails) {
                    detailIndex++;
                    // Place UUID explicitly in second column; assume inv.uuid is duplicated per detail for jump
                    const rowValues = [detailIndex, ...detailsHeaderKeys.map(h => { var _a; return (_a = det[h]) !== null && _a !== void 0 ? _a : ""; })];
                    const addedRow = detailsSheet.addRow(rowValues);
                    addedRow.eachCell(c => (c.alignment = { horizontal: "center" }));
                    if (!(uuid in detailRowMap)) {
                        detailRowMap[uuid] = addedRow.number; // first occurrence row
                    }
                }
            }
            // format shared Details body
            detailsSheet.eachRow((row, rowNumber) => {
                row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                    if (colNumber !== 1) {
                        const isNumber = typeof cell.value === "number" ||
                            (!isNaN(Number(cell.value)) && cell.value !== "");
                        if (isNumber)
                            cell.numFmt = "#,##0.00";
                    }
                    cell.font = { size: 12 };
                    cell.alignment = { horizontal: "center", vertical: "middle" };
                });
            });
            // autosize shared Details columns
            detailsSheet.columns.forEach(col => {
                let max = 0;
                if (typeof col.header === "string")
                    max = col.header.length;
                col.eachCell({ includeEmpty: true }, cell => {
                    var _a;
                    const raw = (_a = cell.value) !== null && _a !== void 0 ? _a : "";
                    const len = String(raw).length;
                    if (len > max)
                        max = len;
                });
                col.width = Math.min(Math.max(max + 8, 10), 50);
            });
            // style shared Details header
            const dhdr = detailsSheet.getRow(1);
            dhdr.height = 22;
            dhdr.eachCell(c => {
                c.font = { bold: true, size: 12, color: { argb: textColor } };
                c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fillColor } };
            });
        }
        else {
            // Separate invoice sheets
            const detailsHeaderKeys = yield getHeaders(detailsHead, taxes);
            for (let i = 0; i < headersList.length; i++) {
                const inv = headersList[i];
                const uuid = inv['الرقم الالكتروني'];
                const sheetName = `${i + 1}`;
                invoiceSheetNames.push(sheetName);
                const invoiceSheet = wb.addWorksheet(sheetName);
                const detailsHeader = ["ID", ...detailsHeaderKeys];
                invoiceSheet.columns = detailsHeader.map(h => ({
                    header: h,
                    key: h,
                    style: { alignment: { horizontal: "center" } }
                }));
                const invDetails = Array.isArray(inv.details) ? inv.details : [];
                let rowIdx = 0;
                for (const det of invDetails) {
                    rowIdx++;
                    const row = [rowIdx, ...detailsHeaderKeys.map(h => { var _a; return (_a = det[h]) !== null && _a !== void 0 ? _a : ""; })];
                    const added = invoiceSheet.addRow(row);
                    added.eachCell(c => (c.alignment = { horizontal: "center" }));
                    if (!(uuid in detailRowMap)) {
                        detailRowMap[uuid] = added.number;
                    }
                }
                invoiceSheet.eachRow((row, rowNumber) => {
                    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                        if (colNumber !== 1) {
                            const isNumber = typeof cell.value === "number" ||
                                (!isNaN(Number(cell.value)) && cell.value !== "");
                            if (isNumber)
                                cell.numFmt = "#,##0.00";
                        }
                        cell.font = { size: 12 };
                        cell.alignment = { horizontal: "center", vertical: "middle" };
                    });
                });
                invoiceSheet.columns.forEach(col => {
                    let max = 0;
                    if (typeof col.header === "string")
                        max = col.header.length;
                    col.eachCell({ includeEmpty: true }, cell => {
                        var _a;
                        const raw = (_a = cell.value) !== null && _a !== void 0 ? _a : "";
                        const len = String(raw).length;
                        if (len > max)
                            max = len;
                    });
                    col.width = Math.min(Math.max(max + 8, 10), 50);
                });
                // style per-invoice sheet header
                const dhdr = invoiceSheet.getRow(1);
                dhdr.height = 22;
                dhdr.eachCell(c => {
                    c.font = { bold: true, size: 12, color: { argb: textColor } };
                    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fillColor } };
                });
            }
        }
        /** ==== PATCH "View" LINKS IN HEADERS ==== */
        headersList.forEach((inv, index) => {
            const uuid = inv['الرقم الالكتروني'];
            const headerRow = headersSheet.getRow(index + 2);
            let linkFormula = "";
            if (cfg.singleSheet) {
                if (uuid in detailRowMap) {
                    // UUID is in column B in Details, link to that cell
                    linkFormula = `=HYPERLINK("#التفاصيل!B${detailRowMap[uuid]}","View")`;
                }
            }
            else {
                const sheetName = invoiceSheetNames[index] || `${index + 1}`;
                linkFormula = `=HYPERLINK("#'${sheetName}'!A1","View")`;
            }
            headerRow.getCell(2).value = { formula: linkFormula, result: "View" };
        });
        // finalize Headers formatting
        headersSheet.eachRow((row, rowNumber) => {
            row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                if (colNumber !== 1) {
                    const isNumber = typeof cell.value === "number" ||
                        (!isNaN(Number(cell.value)) && cell.value !== "");
                    if (isNumber)
                        cell.numFmt = "#,##0.00";
                }
                cell.font = { size: 12 };
                cell.alignment = { horizontal: "center", vertical: "middle" };
            });
        });
        headersSheet.columns.forEach(col => {
            let max = 0;
            if (typeof col.header === "string")
                max = col.header.length;
            col.eachCell({ includeEmpty: true }, cell => {
                var _a;
                const raw = (_a = cell.value) !== null && _a !== void 0 ? _a : "";
                const len = String(raw).length;
                if (len > max)
                    max = len;
            });
            col.width = Math.min(Math.max(max + 8, 10), 50);
        });
        /** ==== SUMMARY SHEET ==== */
        const summarySheet = wb.addWorksheet("Summary");
        const summaryHeaders = Object.keys(summaryList[0] || {});
        summarySheet.columns = summaryHeaders.map(h => ({
            header: h,
            key: h,
            width: Math.max(h.length, ...summaryHeaders.map(r => { var _a; return String((_a = r[h]) !== null && _a !== void 0 ? _a : "").length; })) + 2,
            style: { alignment: { horizontal: "center" } }
        }));
        summaryList.forEach(row => summarySheet.addRow(summaryHeaders.map(h => { var _a; return (_a = row[h]) !== null && _a !== void 0 ? _a : ""; })));
        summarySheet.eachRow((row, rowNumber) => {
            row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                if (colNumber !== 1) {
                    const isNumber = typeof cell.value === "number" ||
                        (!isNaN(Number(cell.value)) && cell.value !== "");
                    if (isNumber)
                        cell.numFmt = "#,##0.00";
                }
                cell.font = { size: 12 };
                cell.alignment = { horizontal: "center", vertical: "middle" };
            });
        });
        summarySheet.columns.forEach(col => {
            let max = 0;
            if (typeof col.header === "string")
                max = col.header.length;
            col.eachCell({ includeEmpty: true }, cell => {
                var _a;
                const raw = (_a = cell.value) !== null && _a !== void 0 ? _a : "";
                const len = String(raw).length;
                if (len > max)
                    max = len;
            });
            col.width = Math.min(Math.max(max + 8, 10), 50);
        });
        //#region sheetsHeaders
        const hdr = headersSheet.getRow(1);
        hdr.height = 22;
        hdr.eachCell(c => {
            c.font = { bold: true, size: 12, color: { argb: textColor } };
            c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fillColor } };
        });
        const shdr = summarySheet.getRow(1);
        shdr.height = 22;
        shdr.eachCell(c => {
            c.font = { bold: true, size: 14, color: { argb: textColor } };
            c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fillColor } };
        });
        //#endregion
        /** ==== FINALIZE DOWNLOAD ==== */
        const buf = yield wb.xlsx.writeBuffer();
        const blob = new Blob([buf], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        });
        const link = Object.assign(document.createElement("a"), {
            href: URL.createObjectURL(blob),
            download: "invoices.xlsx"
        });
        link.click();
        URL.revokeObjectURL(link.href);
    });
}
function buildReceipt(receipt) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
        const flatInv = receipt.receipt;
        const docType = flatInv.documentType.receiptTypeNameAr;
        let T1 = 0, T4 = 0;
        //#region  header
        // Build main header object
        const header = {};
        header.details = [];
        header['الرقم الالكتروني'] = (_a = flatInv['uuid']) !== null && _a !== void 0 ? _a : '';
        headersHead.add('الرقم الالكتروني');
        if (cfg['documentTypeNameAr']) {
            header['نوع المستند'] = docType !== null && docType !== void 0 ? docType : '';
            headersHead.add('نوع المستند');
        }
        header['نسخة المستند'] = flatInv.documentType.typeVersion;
        headersHead.add('نسخة المستند');
        header['حالة المستند'] = flatInv.status;
        headersHead.add('حالة المستند');
        header['تاريخ الاصدار'] = toExcelShortDate(flatInv.dateTimeIssued);
        headersHead.add('تاريخ الاصدار');
        header['تاريخ التقديم'] = toExcelShortDate(flatInv.dateTimeReceived);
        headersHead.add('تاريخ التقديم');
        header['الرقم الداخلي'] = flatInv.receiptNumber;
        headersHead.add('الرقم الداخلي');
        header['العملة'] = flatInv.currency;
        headersHead.add('العملة');
        const rate = flatInv.exchangeRate;
        const totalSales = flatInv.totalSales; // 5000 usd 
        const isForign = rate != 0;
        if (isForign) {
            header['معامل العملة'] = rate;
            headersHead.add('معامل العملة');
            header['totalSales(fc)'] = totalSales;
            headersHead.add('totalSales(fc)');
            header['قيمة الفاتورة'] = totalSales * rate;
            headersHead.add('قيمة الفاتورة');
            header['الخصم'] = flatInv.totalCommercialDiscount * rate;
            headersHead.add('الخصم');
            header['الاجمالي بعد الخصم'] = flatInv.netAmount * rate;
            headersHead.add('الاجمالي بعد الخصم');
        }
        else {
            header['قيمة الفاتورة'] = totalSales;
            headersHead.add('قيمة الفاتورة');
            header['الخصم'] = flatInv.totalCommercialDiscount;
            headersHead.add('الخصم');
            header['الاجمالي بعد الخصم'] = flatInv.netAmount;
            headersHead.add('الاجمالي بعد الخصم');
        }
        // Flatten tax totals
        (flatInv.taxTotals || []).forEach((tax) => {
            if (tax.taxType == 'T1') {
                if (isForign) {
                    header['ضريبه القيمه المضافه بالعمله'] = tax.amount;
                    taxes.add('ضريبه القيمه المضافه بالعمله');
                }
                T1 = isForign ? tax.amount * rate : tax.amount;
                header['ضريبه القيمه المضافه'] = isForign ? tax.amount * rate : tax.amount;
                taxes.add('ضريبه القيمه المضافه');
            }
            else if (tax.taxType == 'T2') {
                header['ضريبه الجدول (نسبيه)'] = isForign ? tax.amount * rate : tax.amount;
                taxes.add('ضريبه الجدول (نسبيه)');
            }
            else if (tax.taxType == 'T3') {
                header['ضريبه الجدول (النوعية)'] = isForign ? tax.amount * rate : tax.amount;
                taxes.add('ضريبه الجدول (النوعية)');
            }
            else if (tax.taxType == 'T4') {
                T4 = isForign ? tax.amount * rate : tax.amount;
                ;
                header['الخصم تحت حساب الضريبه'] = isForign ? tax.amount * rate : tax.amount;
                taxes.add('الخصم تحت حساب الضريبه');
            }
            else if (tax.taxType == 'T5') {
                header['ضريبه الدمغه (نسبيه)'] = isForign ? tax.amount * rate : tax.amount;
                taxes.add('ضريبه الدمغه (نسبيه)');
            }
            else if (tax.taxType == 'T6') {
                header['ضريبه الدمغه (قطعيه بمقدار ثابت)'] = isForign ? tax.amount * rate : tax.amount;
                taxes.add('ضريبه الدمغه (قطعيه بمقدار ثابت)');
            }
            else if (tax.taxType == 'T7') {
                header['ضريبة الملاهى'] = isForign ? tax.amount * rate : tax.amount;
                taxes.add('ضريبة الملاهى');
            }
            else if (tax.taxType == 'T8') {
                header['رسم تنميه الموارد'] = isForign ? tax.amount * rate : tax.amount;
                taxes.add('رسم تنميه الموارد');
            }
            else if (tax.taxType == 'T9') {
                header['رسم خدمة'] = isForign ? tax.amount * rate : tax.amount;
                taxes.add('رسم خدمة');
            }
            else if (tax.taxType == 'T10') {
                header['رسم المحليات'] = isForign ? tax.amount * rate : tax.amount;
                taxes.add('رسم المحليات');
            }
            else if (tax.taxType == 'T11') {
                header['رسم التامين الصحى'] = isForign ? tax.amount * rate : tax.amount;
                taxes.add('رسم التامين الصحى');
            }
            else {
                header['رسوم أخرى'] = isForign ? tax.amount * rate : tax.amount;
                taxes.add('رسوم أخرى');
            }
        });
        if (isForign) {
            header['خصم اضافي علي الفاتورة'] = (_c = (_b = flatInv.extraReceiptDiscount[0]) === null || _b === void 0 ? void 0 : _b.amount) !== null && _c !== void 0 ? _c : 0 * rate;
            headersHead.add('خصم اضافي علي الفاتورة');
            header['اجمالي الفاتورة'] = flatInv.totalAmount * rate;
            headersHead.add('اجمالي الفاتورة');
            header['اجمالي الايصال بالعمله'] = flatInv.totalAmount;
            headersHead.add('اجمالي الايصال بالعمله');
        }
        else {
            header['خصم اضافي علي الفاتورة'] = (_e = (_d = flatInv.extraReceiptDiscount[0]) === null || _d === void 0 ? void 0 : _d.amount) !== null && _e !== void 0 ? _e : 0;
            headersHead.add('خصم اضافي علي الفاتورة');
            header['اجمالي الفاتورة'] = flatInv.totalAmount;
            headersHead.add('اجمالي الفاتورة');
        }
        if (cfg['submitterId']) {
            header['الرقم الضريبي للبائع'] = (_f = flatInv.seller.sellerId) !== null && _f !== void 0 ? _f : '';
            headersHead.add('الرقم الضريبي للبائع');
        }
        if (cfg['submitterName']) {
            header['اسم البائع'] = (_g = flatInv.seller.sellerName) !== null && _g !== void 0 ? _g : '';
            headersHead.add('اسم البائع');
        }
        if (cfg['submitterAndReceiverAddress']) {
            headersHead.add('عنوان البائع');
            if (flatInv.seller.sellerId === taxpayerRIN)
                header['عنوان البائع'] = taxpayerAddress;
            else
                header['عنوان البائع'] = (_h = yield fetchAddressAPI(flatInv.seller.sellerId)) !== null && _h !== void 0 ? _h : "";
        }
        if (cfg['recipientId']) {
            header['الرقم الضريبي للمشتري'] = (_j = flatInv.buyer.buyerId) !== null && _j !== void 0 ? _j : '';
            headersHead.add('الرقم الضريبي للمشتري');
        }
        if (cfg['recipientName']) {
            header['اسم المشتري'] = (_k = flatInv.buyer.buyerName) !== null && _k !== void 0 ? _k : '';
            headersHead.add('اسم المشتري');
        }
        if (cfg['submitterAndReceiverAddress']) {
            header['مرجع طلب البيع'] = (_l = flatInv.sOrderNameCode) !== null && _l !== void 0 ? _l : '';
            headersHead.add('مرجع طلب البيع');
        }
        //#endregion
        //////////////////
        //#region details
        for (const item of flatInv.itemData || []) {
            const row = {};
            row['الرقم الالكتروني'] = flatInv.uuid;
            detailsHead.add('الرقم الالكتروني');
            row['نوع المستند'] = docType;
            detailsHead.add('نوع المستند');
            row['تاريخ الاصدار'] = toExcelShortDate(flatInv.dateTimeIssued);
            detailsHead.add('تاريخ الاصدار');
            row['الرقم الداخلي'] = flatInv.receiptNumber;
            detailsHead.add('الرقم الداخلي');
            row['نوع الصنف'] = item.itemType;
            detailsHead.add('نوع الصنف');
            row['كود الصنف'] = item.itemCode;
            detailsHead.add('كود الصنف');
            row['اسم الصنف'] = item.itemCodeNameAr;
            detailsHead.add('اسم الصنف');
            row['وصف الصنف'] = item.description;
            detailsHead.add('وصف الصنف');
            row['كود الوحدة'] = item.unitType;
            detailsHead.add('كود الوحدة');
            row['الكمية'] = item.quantity;
            detailsHead.add('الكمية');
            if (rate !== 0) {
                row['العمله'] = rate;
                detailsHead.add('العمله');
            }
            row['سعر الوحدة'] = isForign ? item.unitPrice * rate : item.unitPrice;
            detailsHead.add('سعر الوحدة');
            row['القيمة'] = isForign ? item.totalSale * rate : item.totalSale;
            detailsHead.add('القيمة');
            row['الخصم'] = isForign ? (_o = (_m = item.commercialDiscount[0]) === null || _m === void 0 ? void 0 : _m.amount) !== null && _o !== void 0 ? _o : 0 * rate : (_q = (_p = item.commercialDiscount[0]) === null || _p === void 0 ? void 0 : _p.amount) !== null && _q !== void 0 ? _q : 0;
            detailsHead.add('الخصم');
            row['الاجمالي بعد الخصم'] = isForign ? item.netSale * rate : item.netSale;
            detailsHead.add('الاجمالي بعد الخصم');
            (item.taxableItems || []).forEach((tax) => {
                if (tax.taxType == 'T1')
                    row['ضريبه القيمه المضافه'] = isForign ? tax.amount * rate : tax.amount;
                if (tax.taxType == 'T2')
                    row['ضريبه الجدول (نسبيه)'] = isForign ? tax.amount * rate : tax.amount;
                if (tax.taxType == 'T3')
                    row['ضريبه الجدول (النوعية)'] = isForign ? tax.amount * rate : tax.amount;
                if (tax.taxType == 'T4')
                    row['الخصم تحت حساب الضريبه'] = isForign ? tax.amount * rate : tax.amount;
                if (tax.taxType == 'T5')
                    row['ضريبه الدمغه (نسبيه)'] = isForign ? tax.amount * rate : tax.amount;
                if (tax.taxType == 'T6')
                    row['ضريبه الدمغه (قطعيه بمقدار ثابت)'] = isForign ? tax.amount * rate : tax.amount;
                if (tax.taxType == 'T7')
                    row['ضريبة الملاهى'] = isForign ? tax.amount * rate : tax.amount;
                if (tax.taxType == 'T8')
                    row['رسم تنميه الموارد'] = isForign ? tax.amount * rate : tax.amount;
                if (tax.taxType == 'T9')
                    row['رسم خدمة'] = isForign ? tax.amount * rate : tax.amount;
                if (tax.taxType == 'T10')
                    row['رسم المحليات'] = isForign ? tax.amount * rate : tax.amount;
                if (tax.taxType == 'T11')
                    row['رسم التامين الصحى'] = isForign ? tax.amount * rate : tax.amount;
                if (tax.taxType == 'T12')
                    row['رسوم أخرى'] = isForign ? tax.amount * rate : tax.amount;
            });
            row['الاجمالي'] = isForign ? item.total * rate : item.total;
            detailsHead.add('الاجمالي');
            header.details.push(row);
            // detailsList.push(row);
        }
        headersList.push(header);
        //#endregion
        //handle summery
        let typeSummary = summaryList.find(x => x['نوع المستند'] == docType);
        if (!typeSummary) {
            const typeSummary = {};
            typeSummary['نوع المستند'] = docType;
            typeSummary['العدد'] = 1;
            typeSummary['totalNetAmount'] = isForign ? flatInv.netAmount * rate : flatInv.netAmount;
            typeSummary['ضريبه القيمه المضافه'] = T1;
            typeSummary['الخصم تحت حساب الضريبه'] = T4;
            typeSummary['totalinvoiceAmount'] = isForign ? flatInv.totalAmount * rate : flatInv.totalAmount;
            summaryList.push(typeSummary);
        }
        else {
            typeSummary['العدد']++;
            typeSummary['totalNetAmount'] += isForign ? flatInv.netAmount * rate : flatInv.netAmount;
            ;
            typeSummary['ضريبه القيمه المضافه'] += T1;
            typeSummary['الخصم تحت حساب الضريبه'] += T4;
            typeSummary['totalinvoiceAmount'] += isForign ? flatInv.totalAmount * rate : flatInv.totalAmount;
        }
    });
}
function buildInvoice(invoice) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        const flatInv = invoice;
        const docType = flatInv.documentTypeNameSecondaryLang;
        let T1 = 0, T4 = 0;
        //#region  header
        // Build main header object
        const header = {};
        header.details = [];
        header['الرقم الالكتروني'] = (_a = flatInv['uuid']) !== null && _a !== void 0 ? _a : '';
        headersHead.add('الرقم الالكتروني');
        if (cfg['documentTypeNameAr']) {
            header['نوع المستند'] = (_b = flatInv['documentTypeNameSecondaryLang']) !== null && _b !== void 0 ? _b : '';
            headersHead.add('نوع المستند');
        }
        header['نسخة المستند'] = flatInv.documentTypeVersion;
        headersHead.add('نسخة المستند');
        header['حالة المستند'] = flatInv.status;
        headersHead.add('حالة المستند');
        header['تاريخ الاصدار'] = toExcelShortDate(flatInv.dateTimeIssued);
        headersHead.add('تاريخ الاصدار');
        header['تاريخ التقديم'] = toExcelShortDate(flatInv.dateTimeRecevied);
        headersHead.add('تاريخ التقديم');
        header['الرقم الداخلي'] = flatInv.internalID;
        headersHead.add('الرقم الداخلي');
        header['العملة'] = flatInv.currencySegments[0].currency;
        headersHead.add('العملة');
        const isForign = flatInv.currenciesSold == 'Foreign';
        const rate = flatInv.currencySegments[0].currencyExchangeRate;
        const totalSalesFC = flatInv.currencySegments[0].totalSales;
        if (isForign) {
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
        (flatInv.taxTotals || []).forEach((tax) => {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
            if (tax.taxType == 'T1') {
                if (isForign) {
                    header['ضريبه القيمه المضافه بالعمله'] = tax.amount / rate;
                    taxes.add('ضريبه القيمه المضافه بالعمله');
                }
                T1 = tax.amount;
                header['ضريبه القيمه المضافه'] = (_a = tax.amount) !== null && _a !== void 0 ? _a : '';
                taxes.add('ضريبه القيمه المضافه');
            }
            else if (tax.taxType == 'T2') {
                header['ضريبه الجدول (نسبيه)'] = (_b = tax.amount) !== null && _b !== void 0 ? _b : '';
                taxes.add('ضريبه الجدول (نسبيه)');
            }
            else if (tax.taxType == 'T3') {
                header['ضريبه الجدول (النوعية)'] = (_c = tax.amount) !== null && _c !== void 0 ? _c : '';
                taxes.add('ضريبه الجدول (النوعية)');
            }
            else if (tax.taxType == 'T4') {
                T4 = tax.amount;
                header['الخصم تحت حساب الضريبه'] = (_d = tax.amount) !== null && _d !== void 0 ? _d : '';
                taxes.add('الخصم تحت حساب الضريبه');
            }
            else if (tax.taxType == 'T5') {
                header['ضريبه الدمغه (نسبيه)'] = (_e = tax.amount) !== null && _e !== void 0 ? _e : '';
                taxes.add('ضريبه الدمغه (نسبيه)');
            }
            else if (tax.taxType == 'T6') {
                header['ضريبه الدمغه (قطعيه بمقدار ثابت)'] = (_f = tax.amount) !== null && _f !== void 0 ? _f : '';
                taxes.add('ضريبه الدمغه (قطعيه بمقدار ثابت)');
            }
            else if (tax.taxType == 'T7') {
                header['ضريبة الملاهى'] = (_g = tax.amount) !== null && _g !== void 0 ? _g : '';
                taxes.add('ضريبة الملاهى');
            }
            else if (tax.taxType == 'T8') {
                header['رسم تنميه الموارد'] = (_h = tax.amount) !== null && _h !== void 0 ? _h : '';
                taxes.add('رسم تنميه الموارد');
            }
            else if (tax.taxType == 'T9') {
                header['رسم خدمة'] = (_j = tax.amount) !== null && _j !== void 0 ? _j : '';
                taxes.add('رسم خدمة');
            }
            else if (tax.taxType == 'T10') {
                header['رسم المحليات'] = (_k = tax.amount) !== null && _k !== void 0 ? _k : '';
                taxes.add('رسم المحليات');
            }
            else if (tax.taxType == 'T11') {
                header['رسم التامين الصحى'] = (_l = tax.amount) !== null && _l !== void 0 ? _l : '';
                taxes.add('رسم التامين الصحى');
            }
            else {
                header['رسوم أخرى'] = (_m = tax.amount) !== null && _m !== void 0 ? _m : '';
                taxes.add('رسوم أخرى');
            }
        });
        header['خصم اضافي علي الفاتورة'] = flatInv.extraDiscountAmount;
        headersHead.add('خصم اضافي علي الفاتورة');
        header['اجمالي الفاتورة'] = flatInv.totalAmount;
        headersHead.add('اجمالي الفاتورة');
        if (isForign) {
            header['اجمالي الفاتورة بالعمله'] = flatInv.currencySegments[0].totalAmount;
            headersHead.add('اجمالي الفاتورة بالعمله');
        }
        if (cfg['submitterId']) {
            header['الرقم الضريبي للبائع'] = (_c = flatInv.issuer.id) !== null && _c !== void 0 ? _c : '';
            headersHead.add('الرقم الضريبي للبائع');
        }
        if (cfg['submitterName']) {
            header['اسم البائع'] = (_d = flatInv.issuer.name) !== null && _d !== void 0 ? _d : '';
            headersHead.add('اسم البائع');
        }
        if (cfg['submitterAndReceiverAddress']) {
            headersHead.add('عنوان البائع');
            if (flatInv.issuer.id === taxpayerRIN)
                header['عنوان البائع'] = taxpayerAddress;
            else
                header['عنوان البائع'] = (_e = yield fetchAddressAPI(flatInv.issuer.id)) !== null && _e !== void 0 ? _e : "";
        }
        if (cfg['recipientId']) {
            header['الرقم الضريبي للمشتري'] = (_f = flatInv.receiver.id) !== null && _f !== void 0 ? _f : '';
            headersHead.add('الرقم الضريبي للمشتري');
        }
        if (cfg['recipientName']) {
            header['اسم المشتري'] = (_g = flatInv.receiver.name) !== null && _g !== void 0 ? _g : '';
            headersHead.add('اسم المشتري');
        }
        if (cfg['submitterAndReceiverAddress']) {
            headersHead.add('عنوان المشتري');
            if (flatInv.receiver.id !== taxpayerRIN)
                header['عنوان المشتري'] = (_h = yield fetchAddressAPI(flatInv.receiver.id)) !== null && _h !== void 0 ? _h : "";
            else
                header['عنوان المشتري'] = taxpayerAddress;
        }
        if (cfg['submitterAndReceiverAddress']) {
            header['مرجع طلب الشراء'] = (_j = flatInv.purchaseOrderReference) !== null && _j !== void 0 ? _j : '';
            headersHead.add('مرجع طلب الشراء');
            header['مرجع طلب البيع'] = (_k = flatInv.salesOrderReference) !== null && _k !== void 0 ? _k : '';
            headersHead.add('مرجع طلب البيع');
        }
        //#endregion
        //////////////////
        //#region details
        for (const item of flatInv.invoiceLines || []) {
            const unit = item.unitValue || {};
            const row = {};
            row['الرقم الالكتروني'] = flatInv.uuid;
            detailsHead.add('الرقم الالكتروني');
            row['نوع المستند'] = flatInv.documentTypeNameSecondaryLang;
            detailsHead.add('نوع المستند');
            row['تاريخ الاصدار'] = toExcelShortDate(flatInv.dateTimeIssued);
            detailsHead.add('تاريخ الاصدار');
            row['الرقم الداخلي'] = flatInv.internalID;
            detailsHead.add('الرقم الداخلي');
            row['نوع الصنف'] = item.itemType;
            detailsHead.add('نوع الصنف');
            row['كود الصنف'] = item.itemCode;
            detailsHead.add('كود الصنف');
            row['اسم الصنف'] = item.itemSecondaryName;
            detailsHead.add('اسم الصنف');
            row['وصف الصنف'] = item.description;
            detailsHead.add('وصف الصنف');
            row['كود الوحدة'] = item.unitType;
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
            (item.lineTaxableItems || []).forEach((tax) => {
                var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
                if (tax.taxType == 'T1')
                    row['ضريبه القيمه المضافه'] = (_a = tax.amount) !== null && _a !== void 0 ? _a : '';
                if (tax.taxType == 'T2')
                    row['ضريبه الجدول (نسبيه)'] = (_b = tax.amount) !== null && _b !== void 0 ? _b : '';
                if (tax.taxType == 'T3')
                    row['ضريبه الجدول (النوعية)'] = (_c = tax.amount) !== null && _c !== void 0 ? _c : '';
                if (tax.taxType == 'T4')
                    row['الخصم تحت حساب الضريبه'] = (_d = tax.amount) !== null && _d !== void 0 ? _d : '';
                if (tax.taxType == 'T5')
                    row['ضريبه الدمغه (نسبيه)'] = (_e = tax.amount) !== null && _e !== void 0 ? _e : '';
                if (tax.taxType == 'T6')
                    row['ضريبه الدمغه (قطعيه بمقدار ثابت)'] = (_f = tax.amount) !== null && _f !== void 0 ? _f : '';
                if (tax.taxType == 'T7')
                    row['ضريبة الملاهى'] = (_g = tax.amount) !== null && _g !== void 0 ? _g : '';
                if (tax.taxType == 'T8')
                    row['رسم تنميه الموارد'] = (_h = tax.amount) !== null && _h !== void 0 ? _h : '';
                if (tax.taxType == 'T9')
                    row['رسم خدمة'] = (_j = tax.amount) !== null && _j !== void 0 ? _j : '';
                if (tax.taxType == 'T10')
                    row['رسم المحليات'] = (_k = tax.amount) !== null && _k !== void 0 ? _k : '';
                if (tax.taxType == 'T11')
                    row['رسم التامين الصحى'] = (_l = tax.amount) !== null && _l !== void 0 ? _l : '';
                if (tax.taxType == 'T12')
                    row['رسوم أخرى'] = (_m = tax.amount) !== null && _m !== void 0 ? _m : '';
            });
            row['الاجمالي'] = item.total;
            detailsHead.add('الاجمالي');
            header.details.push(row);
            // detailsList.push(row);
        }
        headersList.push(header);
        //#endregion
        //handle summery
        let typeSummary = summaryList.find(x => x['نوع المستند'] == docType);
        if (!typeSummary) {
            const typeSummary = {};
            typeSummary['نوع المستند'] = docType;
            typeSummary['العدد'] = 1;
            typeSummary['totalNetAmount'] = flatInv.netAmount;
            typeSummary['ضريبه القيمه المضافه'] = T1;
            typeSummary['الخصم تحت حساب الضريبه'] = T4;
            typeSummary['totalinvoiceAmount'] = flatInv.totalAmount;
            summaryList.push(typeSummary);
        }
        else {
            typeSummary['العدد']++;
            typeSummary['totalNetAmount'] += flatInv.netAmount;
            typeSummary['ضريبه القيمه المضافه'] += T1;
            typeSummary['الخصم تحت حساب الضريبه'] += T4;
            typeSummary['totalinvoiceAmount'] += flatInv.totalAmount;
        }
    });
}
function getHeaders(heads, taxs) {
    return __awaiter(this, void 0, void 0, function* () {
        const headers = [];
        for (const element of heads) {
            headers.push(element);
            if (element == 'الاجمالي بعد الخصم') {
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
                    if (isAInPriority)
                        return -1; // a comes before b
                    if (isBInPriority)
                        return 1; // b comes before a
                    // If both are not in the priority list, sort alphabetically
                    return a.localeCompare(b, 'ar'); // Use 'ar' locale for Arabic
                });
                for (const tax of taxesArray) {
                    headers.push(tax);
                }
            }
        }
        return headers;
    });
}
function toExcelShortDate(isoDateStr) {
    if (!isoDateStr)
        return "";
    const date = new Date(isoDateStr);
    if (isNaN(date.getTime()))
        return "";
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0'); // months are 0-based
    const yyyy = date.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
}
function collectSelectedFields() {
    const modal = getModalEl();
    const set = new Set();
    const boxes = modal.querySelectorAll("input[type='checkbox'][data-field]");
    boxes.forEach(cb => {
        if (cb.checked && cb.dataset.field)
            set.add(cb.dataset.field);
    });
    return set;
}
function buildConfigFromSelection(selected) {
    return {
        documentTypeNameAr: selected.has("documentTypeNameAr"),
        submitterId: selected.has("submitterId"),
        submitterName: selected.has("submitterName"),
        recipientId: selected.has("ReceiverTaxNumber"),
        recipientName: selected.has("recipientName"),
        submitterAndReceiverAddress: selected.has("submitterAndReceiverAddress"),
        PORSOR: selected.has("PORSOR"),
        singleSheet: selected.has("singleSheet"),
    };
}
;
function ensureArgb(hexColor) {
    hexColor = hexColor.replace('#', '').toUpperCase();
    return hexColor.length === 6 ? 'FF' + hexColor : hexColor;
}
function loadOptions() {
    try {
        const stored = localStorage.getItem('eta_export_options');
        if (!stored)
            return Object.assign({}, DEFAULT_OPTIONS);
        const parsed = JSON.parse(stored);
        return Object.assign(Object.assign({}, DEFAULT_OPTIONS), parsed); // merge with defaults
    }
    catch (e) {
        console.warn("Failed to load options, falling back to defaults", e);
        return Object.assign({}, DEFAULT_OPTIONS);
    }
}
function saveOptions(opts) {
    try {
        localStorage.setItem('eta_export_options', JSON.stringify(opts));
    }
    catch (e) {
        console.warn("Failed to save options", e);
    }
}
//#endregion
//////////////////////////////////////////////////////
//#region  global Functions 
//#region  modal
function ensureModal(type) {
    var _a, _b;
    // Remove both modals if they’re already in the DOM
    (_a = document.getElementById("eta-bootstrap-modal")) === null || _a === void 0 ? void 0 : _a.remove();
    (_b = document.getElementById("eta-bootstrap-receipt-modal")) === null || _b === void 0 ? void 0 : _b.remove();
    // Inject the requested one
    document.body.insertAdjacentHTML("beforeend", modalTemplates[type]);
    applyOptionsToModal();
    setupOptionListeners();
    // inject CSS class that uses the extension asset
    const style = document.createElement("style");
    style.textContent = `
  .modal-body.custom-bg {
    background-image: url(${logoUrl});
margin-right:5px;
    background-repeat: no-repeat;
    background-position: right top;
  }
`;
    document.head.appendChild(style);
    // apply the class when the modal appears
    const applyBackground = () => {
        const modalBody = document.querySelector(".modal-body");
        if (modalBody) {
            modalBody.classList.add("custom-bg");
        }
    };
    // if modal is added dynamically, observe or retry
    applyBackground();
}
function openModalById(id) {
    $(`#${id}`).modal({ backdrop: 'static', keyboard: true });
    $(`#${id}`).modal('show');
}
//#endregion
function getModalEl() {
    const el = document.getElementById("eta-bootstrap-modal");
    if (!el)
        throw new Error("Modal element not found");
    return el;
}
function sleep(ms) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise(resolve => setTimeout(resolve, ms));
    });
}
function updateCount(count) {
    return __awaiter(this, void 0, void 0, function* () {
        const total = uuidsList.length;
        const el = document.getElementById('docCount');
        if (el) {
            el.innerText = `تحت المعالجة ${count} / ${total} (${Math.round(count / total * 100)}%)`;
        }
    });
}
function applyOptionsToModal() {
    const opts = loadOptions();
    // checkboxes
    const modal = getModalEl();
    Object.entries(opts).forEach(([key, value]) => {
        if (key === "headerColor" || key === "headerTextColor")
            return;
        const cb = modal.querySelector(`input[type=checkbox][data-field="${key}"]`);
        if (cb)
            cb.checked = !!value;
    });
    // color pickers
    const headerColorInput = modal.querySelector("#headerColor");
    const headerTextColorInput = modal.querySelector("#headerTextColor");
    if (headerColorInput)
        headerColorInput.value = opts.headerColor;
    if (headerTextColorInput)
        headerTextColorInput.value = opts.headerTextColor;
}
function setupOptionListeners() {
    const modal = getModalEl();
    // checkbox changes
    modal.querySelectorAll("input[type=checkbox][data-field]").forEach(cb => {
        cb.addEventListener("change", () => {
            const opts = loadOptions();
            if (cb.dataset.field) {
                opts[cb.dataset.field] = cb.checked;
                saveOptions(opts);
            }
        });
    });
    // color pickers
    const headerColorInput = modal.querySelector("#headerColor");
    const headerTextColorInput = modal.querySelector("#headerTextColor");
    headerColorInput === null || headerColorInput === void 0 ? void 0 : headerColorInput.addEventListener("input", () => {
        const opts = loadOptions();
        opts.headerColor = headerColorInput.value;
        saveOptions(opts);
    });
    headerTextColorInput === null || headerTextColorInput === void 0 ? void 0 : headerTextColorInput.addEventListener("input", () => {
        const opts = loadOptions();
        opts.headerTextColor = headerTextColorInput.value;
        saveOptions(opts);
    });
}
function injectSpinner() {
    if (document.getElementById('eta-spinner'))
        return;
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
function showSpinner(show) {
    document.getElementById('eta-spinner').style.display = show ? 'flex' : 'none';
}
function loadTooltip() {
    const tooltipTriggerList = document.querySelectorAll('[data-toggle="tooltip"]');
    tooltipTriggerList.forEach((tooltipTriggerEl) => {
        new bootstrap.Tooltip(tooltipTriggerEl);
    });
}
//#endregion
//#region  fetching from portal
function fetchUUIDs() {
    return __awaiter(this, void 0, void 0, function* () {
        uuidsList = [];
        headersHead = new Set();
        detailsHead = new Set();
        taxes = new Set();
        headersList = [];
        detailsList = [];
        summaryList = [];
        const seenUUIDs = new Set(); // 👈 Track UUIDs to prevent duplicates
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
            const res = yield fetch(pageUrl, {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${user_token}`
                }
            });
            if (!res.ok)
                throw new Error(`ETA API ${res.status}`);
            const json = yield res.json();
            if (isInvoices) {
                const result = json.result;
                for (const inv of result) {
                    const uuid = isRecent ? inv.uuid : inv.source.uuid;
                    const internalId = isRecent ? inv.internalId : inv.source.internalId;
                    const docType = isRecent ? inv.documentTypeNameSecondaryLang : inv.source.documentTypeNameAr;
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
        } while (page <= totalPages);
    });
}
function fetchDetails() {
    return __awaiter(this, arguments, void 0, function* (dir = "documents") {
        let index = 0;
        for (const meta of uuidsList) {
            try {
                const result = yield getDocumentDetails(meta.uuid, dir);
                if (result) {
                    if (dir === "documents") {
                        yield buildInvoice(result);
                        index++;
                        yield updateCount(index);
                    }
                    else {
                        yield buildReceipt(result);
                        index++;
                        yield updateCount(index);
                    }
                }
            }
            catch (error) {
                console.warn(`Error fetching details for UUID ${meta.uuid}`, error);
            }
            // Optional: Wait 500ms between each request
            yield new Promise(resolve => setTimeout(resolve, 100));
        }
    });
}
function getDocumentDetails(uuid_1) {
    return __awaiter(this, arguments, void 0, function* (uuid, dir = "documents", retries = 0) {
        const url = `${API}/${dir}/${uuid}/details`;
        if (dir == "documents")
            url + "?documentLinesLimit=1000";
        return new Promise((resolve) => {
            $.ajax({
                url: url,
                method: "GET",
                cache: false,
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${user_token}`,
                    "Accept-Language": localStorage.i18nextLng || "ar"
                },
                success: function (data) {
                    resolve(data);
                },
                error: function (xhr, status, error) {
                    return __awaiter(this, void 0, void 0, function* () {
                        console.warn(`Failed to fetch invoice ${uuid} (attempt ${retries + 1}):`, status, error);
                        if ((status === 'timeout' || status === 'error' || status === 'canceled') && retries < 2) {
                            // Retry only if request was canceled
                            const retryResult = yield getDocumentDetails(uuid, dir, retries + 1);
                            resolve(retryResult);
                        }
                        else {
                            // For any other failure or max retries reached
                            resolve(null);
                        }
                    });
                }
            });
        });
    });
}
function fetchAddressAPI(taxNumber) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!taxNumber)
            return "";
        try {
            const url = `${API}/taxpayers/${taxNumber}/light`;
            const res = yield fetch(url, {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${user_token}`
                }
            });
            if (!res.ok)
                throw new Error(`Address API returned HTTP ${res.status}`);
            const json = yield res.json();
            let address = json.taxpayerBranchs[0].sourceAddress;
            return address !== null && address !== void 0 ? address : '';
        }
        catch (err) {
            console.error("Could not load Address", err);
            return '';
        }
    });
}
function fetchAddress() {
    return __awaiter(this, void 0, void 0, function* () {
        const cached = localStorage.getItem('taxpayerAddress');
        const taxNumber = localStorage.getItem('RIN');
        if (cached) {
            taxpayerAddress = cached;
            return;
        }
        // B) else hit the API
        taxpayerAddress = yield fetchAddressAPI(taxNumber);
        localStorage.setItem('taxpayerAddress', JSON.stringify(taxpayerAddress));
        return;
    });
}
//#endregion
///////////////////////////////////////////////////////
const modalTemplates = {
    invoice: `
  <div class="modal fade" id="eta-bootstrap-modal" tabindex="1" aria-labelledby="modalTitle" aria-hidden="true">
    <div class="modal-dialog modal-dialog-scrollable modal-lg">
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
            <div class="col-6 d-inline-block">
            <label>نوع المستند <input type="checkbox" data-field="documentTypeNameAr" checked></label><br/>
            <label>عنوان البائع والمشتري <input type="checkbox" data-field="submitterAndReceiverAddress"></label><br/>
            <label>مرجع طلب الشراء والبيع <input type="checkbox" data-field="PORSOR"></label><br/>
            <label> فواتير مجمعه <input type="checkbox" data-field="singleSheet" checked></label><br/>
            
            </div>
            
            <div class="col-5 d-inline-block">
            <label>اسم البائع <input type="checkbox" data-field="submitterName" checked></label><br/>
            <label>رقم التسجيل الضريبي للبائع <input type="checkbox" data-field="submitterId" checked></label><br/>
            <label>اسم المشتري <input type="checkbox" data-field="recipientName" checked></label><br/>
            <label>رقم التسجيل الضريبي للمشتري<input type="checkbox" data-field="ReceiverTaxNumber" checked></label><br/>
            
            </div>
            
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
    receipt: `
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
