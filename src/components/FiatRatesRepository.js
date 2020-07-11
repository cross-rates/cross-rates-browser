import LocalStorageRepository from "./LocalStorageRepository";

const fiatRatesRepository = LocalStorageRepository.builder()
    .name('fiat-rates')
    .nullObject([])
    .build();

export default fiatRatesRepository
