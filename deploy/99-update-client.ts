import fs from "fs-extra"
import { ethers, network } from "hardhat"
import path from "path"

const contractNames = ["RGStaking", "RGToken"]
const clientFolderName = "nextJs"
let constantsPath: string

export default async () => {
    if (!process.env.UPDATE_CLIENT) return

    console.log("Updating Client...")
    constantsPath = path.resolve(__dirname, `../../${clientFolderName}/constants/`)

    for (let contractName of contractNames) {
        const contract = await ethers.getContract(contractName)

        writeAbi(contractName)
        writeAddress(contract.address, contractName)

        console.log(`Client updated with ${contractName}.`)
    }
    console.log("Client updates successful.")
    console.log("=====================================================================")
}

const writeAbi = (contractName: string) => {
    const abiDir = path.resolve(__dirname, `../artifacts/contracts/${contractName}.sol/${contractName}.json`)
    const abi = fs.readJSONSync(abiDir, "utf8").abi
    fs.outputJSONSync(path.resolve(constantsPath, `${contractName}.json`), abi)
}

const writeAddress = (address: string, contractName: string) => {
    const addressesFile = path.resolve(constantsPath, `${contractName}Addresses.json`)

    const contractAddresses = getCurrentAddresses(addressesFile)
    const updatedAddresses = updateAddresses(contractAddresses, address)

    fs.outputJSONSync(addressesFile, updatedAddresses)
}

const getCurrentAddresses = (addressesFile: string) => {
    fs.ensureFileSync(addressesFile)
    let contractAddresses = {}

    try {
        contractAddresses = fs.readJSONSync(addressesFile)
    } catch (error) {
        if (!(error instanceof SyntaxError)) {
            console.log(error)
            process.exit(1)
        }
    }

    return contractAddresses
}

const updateAddresses = (contractAddresses: any, newAddress: string) => {
    const chainId = network.config.chainId!.toString()

    if (chainId in contractAddresses) {
        if (!contractAddresses[chainId].includes(newAddress)) {
            contractAddresses[chainId].push(newAddress)
        }
    } else {
        contractAddresses[chainId] = [newAddress]
    }

    return contractAddresses
}
