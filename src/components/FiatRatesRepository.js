import {LocalStorageRepository} from "./LocalStorageRepository";

export const fiatRatesRepository = LocalStorageRepository.builder()
    .name('fiat-rates')
    .nullObject([])
    .build();
