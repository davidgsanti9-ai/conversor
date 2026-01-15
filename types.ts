
export interface Currency {
  code: string;
  name: string;
  flag: string;
}

export interface ExchangeRates {
  [key: string]: number;
}

export interface SavedConversion {
  id: string;
  amount: number;
  from: string;
  to: string;
  fromFlag: string;
  toFlag: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}
