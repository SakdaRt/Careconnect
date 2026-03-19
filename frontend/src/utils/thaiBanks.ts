export type ThaiBankOption = {
  bankCode: string;
  shortName: string;
  nameTh: string;
  nameEn: string;
};

export const THAI_BANK_OPTIONS: ThaiBankOption[] = [
  { bankCode: "002", shortName: "BBL", nameTh: "ธนาคารกรุงเทพ", nameEn: "Bangkok Bank" },
  { bankCode: "004", shortName: "KBANK", nameTh: "ธนาคารกสิกรไทย", nameEn: "Kasikornbank" },
  { bankCode: "006", shortName: "KTB", nameTh: "ธนาคารกรุงไทย", nameEn: "Krung Thai Bank" },
  { bankCode: "011", shortName: "TTB", nameTh: "ธนาคารทหารไทยธนชาต", nameEn: "TMBThanachart Bank" },
  { bankCode: "014", shortName: "SCB", nameTh: "ธนาคารไทยพาณิชย์", nameEn: "Siam Commercial Bank" },
  { bankCode: "025", shortName: "BAY", nameTh: "ธนาคารกรุงศรีอยุธยา", nameEn: "Bank of Ayudhya" },
  { bankCode: "030", shortName: "GSB", nameTh: "ธนาคารออมสิน", nameEn: "Government Savings Bank" },
  { bankCode: "034", shortName: "BAAC", nameTh: "ธนาคารเพื่อการเกษตรและสหกรณ์การเกษตร", nameEn: "Bank for Agriculture and Agricultural Cooperatives" },
  { bankCode: "066", shortName: "ISBT", nameTh: "ธนาคารอิสลามแห่งประเทศไทย", nameEn: "Islamic Bank of Thailand" },
  { bankCode: "067", shortName: "TISCO", nameTh: "ธนาคารทิสโก้", nameEn: "TISCO Bank" },
  { bankCode: "069", shortName: "KKP", nameTh: "ธนาคารเกียรตินาคินภัทร", nameEn: "Kiatnakin Phatra Bank" },
  { bankCode: "070", shortName: "CIMBT", nameTh: "ธนาคารซีไอเอ็มบี ไทย", nameEn: "CIMB Thai Bank" },
  { bankCode: "071", shortName: "UOB", nameTh: "ธนาคารยูโอบี", nameEn: "United Overseas Bank (Thai)" },
  { bankCode: "073", shortName: "LHBANK", nameTh: "ธนาคารแลนด์ แอนด์ เฮ้าส์", nameEn: "Land and Houses Bank" },
  { bankCode: "098", shortName: "SME D", nameTh: "ธนาคารพัฒนาวิสาหกิจขนาดกลางและขนาดย่อมแห่งประเทศไทย", nameEn: "SME Development Bank" },
];

export function findBankByCode(code: string): ThaiBankOption | undefined {
  return THAI_BANK_OPTIONS.find(
    (b) => b.bankCode === code || b.shortName.toUpperCase() === code.toUpperCase()
  );
}
