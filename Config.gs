const SHEET_NAMES = {
  USERS:'Users', ORDERS:'ProductionOrders', LOG:'StatusLog',
  SHIP:'Shipments', ITEMS:'Items', MASTERS:'Masters'
};
const PROCESSES = [
  'レーザ工程','曲げ工程','外枠組立工程','シャッター組立工程','シャッター溶接工程',
  'コーキング工程','外枠塗装工程','組立工程（組立中）','組立工程（組立済）','外注','検査工程'
];
const STATUSES = ['生産開始','検査保留','検査済','出荷準備','出荷済','不良品（要リペア）'];
