function doGet() {
  const tmpl = HtmlService.createTemplateFromFile('Index');
  // GANTI dengan file ID logo TSH di Google Drive (shareable)
  tmpl.logoUrl = 'https://drive.google.com/uc?id=YOUR_FILE_ID';
  tmpl.appName = 'ERP Mini';
  return tmpl.evaluate()
    .setTitle('ERP Mini')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .setSandboxMode(HtmlService.SandboxMode.IFRAME);
}
function include(filename){
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
