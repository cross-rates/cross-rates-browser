import LocalStorageRepository from "./LocalStorageRepository";

const cryptoCurrenciesRepository = LocalStorageRepository.builder()
    .name('crypto-currencies')
    .nullObject([])
    .build();

export default cryptoCurrenciesRepository
