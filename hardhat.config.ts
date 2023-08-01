import "dotenv/config"
import "hardhat-deploy"
import "hardhat-gas-reporter"
import "solidity-coverage"

import { HardhatUserConfig } from "hardhat/config"

import "@nomicfoundation/hardhat-toolbox"

import "@nomiclabs/hardhat-etherscan"
import "@nomiclabs/hardhat-solhint"

const FUJI_RPC_URL = process.env.FUJI_RPC_URL
const PRIVATE_KEY = process.env.PRIVATE_KEY
const COINMARKETCAP_API_KEY = process.env.COINMARKETCAP_API_KEY
const SNOWTRACE_API_KEY = process.env.SNOWTRACE_API_KEY || "Your snowtrace API key"

const config: HardhatUserConfig = {
    solidity: {
        compilers: [
            {
                version: "0.8.7",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200,
                    },
                },
            },
        ],
    },
    defaultNetwork: "hardhat",
    networks: {
        localhost: {
            chainId: 31337,
        },
        fuji: {
            url: FUJI_RPC_URL !== undefined ? FUJI_RPC_URL : "",
            accounts: PRIVATE_KEY !== undefined ? [PRIVATE_KEY] : [],
            saveDeployments: true,
            chainId: 43113,
        },
    },
    etherscan: {
        apiKey: SNOWTRACE_API_KEY,
    },
    gasReporter: {
        enabled: process.env.REPORT_GAS !== undefined,
        outputFile: "gasReport.txt",
        noColors: true,
        currency: "GHS",
        coinmarketcap: COINMARKETCAP_API_KEY,
        token: "AVAX",
    },
    namedAccounts: {
        deployer: {
            default: 0,
        },
    },
    mocha: {
        timeout: 200000, // 200 seconds max for running tests
    },
    typechain: {
        outDir: "typechain",
        target: "ethers-v5",
    },
}

export default config
