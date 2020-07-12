import {LocalStorageRepository} from "./LocalStorageRepository";

export const cryptoCurrenciesRepository = LocalStorageRepository.builder()
    .name('crypto-currencies')
    .nullObject([])
    .build();
