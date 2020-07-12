import {LocalStorageRepository} from "./LocalStorageRepository";

export const cryptoRatesRepository = LocalStorageRepository.builder()
    .name('crypto-rates')
    .nullObject([])
    .build();
