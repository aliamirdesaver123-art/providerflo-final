export interface BusinessProfileDTO {
  name: string;
  abn: string;
  email: string;
  phone: string;
  address: string;
  suburb: string;
  state: string;
  postcode: string;
  formattedAddress: string;
  latitude: number | null;
  longitude: number | null;
  placeId: string | null;
  logoUrl: string;
  bankAccountName: string;
  bankBsb: string;
  bankAccountNumber: string;
  paymentInstructions: string;
  brandingVersion: number;
}

export type BusinessProfileUpdatePayload = Omit<BusinessProfileDTO, "brandingVersion">;

export const emptyBusinessProfile: BusinessProfileDTO = {
  name: "",
  abn: "",
  email: "",
  phone: "",
  address: "",
  suburb: "",
  state: "",
  postcode: "",
  formattedAddress: "",
  latitude: null,
  longitude: null,
  placeId: null,
  logoUrl: "",
  bankAccountName: "",
  bankBsb: "",
  bankAccountNumber: "",
  paymentInstructions: "",
  brandingVersion: 0,
};

export function toBusinessProfileUpdatePayload(
  state: BusinessProfileDTO
): BusinessProfileUpdatePayload {
  return {
    name: state.name ?? "",
    abn: state.abn ?? "",
    email: state.email ?? "",
    phone: state.phone ?? "",
    address: state.address ?? "",
    suburb: state.suburb ?? "",
    state: state.state ?? "",
    postcode: state.postcode ?? "",
    formattedAddress: state.formattedAddress ?? "",
    latitude: state.latitude ?? null,
    longitude: state.longitude ?? null,
    placeId: state.placeId ?? null,
    logoUrl: state.logoUrl ?? "",
    bankAccountName: state.bankAccountName ?? "",
    bankBsb: state.bankBsb ?? "",
    bankAccountNumber: state.bankAccountNumber ?? "",
    paymentInstructions: state.paymentInstructions ?? "",
  };
}
