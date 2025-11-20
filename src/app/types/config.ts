// src/types/config.ts
export type ClinicServices = {
  decompression: boolean;
  classIVLaser: boolean;
  shockwave: boolean;
};

export type ClinicConfig = {
  clinicName: string;
  doctorName: string;
  firstVisitCost: number;
  address: string;
  officeHours: string;
  services: ClinicServices;
};
