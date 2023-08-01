import { network } from "hardhat"
import { DeployFunction } from "hardhat-deploy/types"

import { HardhatRuntimeEnvironment } from "hardhat/types"

import { parseRGT, verify } from "../helper-functions"
import { isLocalNetwork, networkConfig } from "../helper-hardhat-config"

const func: DeployFunction = async ({ getNamedAccounts, deployments }: HardhatRuntimeEnvironment) => {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    const chainId = network.config.chainId!
    const currentNetwork = networkConfig[chainId]

    const initialSupplyTokens = 100_000_000_000 // 100 billion tokens
    const initialSupply = parseRGT(initialSupplyTokens)

    const args = [initialSupply]
    const rGToken = await deploy("RGToken", {
        from: deployer,
        args,
        log: true,
        waitConfirmations: currentNetwork.waitConfirmations,
    })
    log("=====================================================================")

    if (!isLocalNetwork && process.env.SNOWTRACE_API_KEY) {
        await verify(rGToken.address, "contracts/RGToken.sol:RGToken", args)
        log("=====================================================================")
    }
}

func.tags = ["rGToken"]
export default func
