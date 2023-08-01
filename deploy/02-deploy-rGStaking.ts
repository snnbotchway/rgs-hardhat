import { ethers, network } from "hardhat"
import { DeployFunction } from "hardhat-deploy/types"

import { HardhatRuntimeEnvironment } from "hardhat/types"

import { initializeRewardPool, verify } from "../helper-functions"
import { isLocalNetwork, networkConfig } from "../helper-hardhat-config"
import { RGToken } from "../typechain"

const func: DeployFunction = async ({ getNamedAccounts, deployments }: HardhatRuntimeEnvironment) => {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    const chainId = network.config.chainId!
    const currentNetwork = networkConfig[chainId]

    const rGToken: RGToken = await ethers.getContract("RGToken")

    const args = [rGToken.address]
    let rGStaking = await deploy("RGStaking", {
        from: deployer,
        args,
        log: true,
        waitConfirmations: currentNetwork.waitConfirmations,
    })
    log("=====================================================================")

    if (!isLocalNetwork) {
        const initialBalance = (await rGToken.balanceOf(rGStaking.address)).toString()
        console.log(`Initializing rewards pool...Current balance: ${ethers.utils.formatEther(initialBalance)}`)

        await initializeRewardPool(deployer)

        const finalBalance = (await rGToken.balanceOf(rGStaking.address)).toString()
        console.log(`Rewards pool initialized. Current balance: ${ethers.utils.formatUnits(finalBalance)}`)
        log("=====================================================================")
    }

    if (!isLocalNetwork && process.env.SNOWTRACE_API_KEY) {
        await verify(rGStaking.address, "contracts/RGStaking.sol:RGStaking", args)
        log("=====================================================================")
    }
}

func.tags = ["rGStaking"]
export default func
