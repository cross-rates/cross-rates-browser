import LocalStorageRepository from "./LocalStorageRepository";

const cryptoRatesRepository = LocalStorageRepository.builder()
    .name('crypto-rates')
    .nullObject([])
    .build();

export default cryptoRatesRepository
