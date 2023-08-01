import { expect } from "chai"
import { deployments, ethers } from "hardhat"

import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers"

import { initializeRewardPool, parseRGT } from "../../helper-functions"
import { TOTAL_REWARD_POOL, isLocalNetwork } from "../../helper-hardhat-config"
import { RGStaking, RGToken } from "../../typechain"

!isLocalNetwork
    ? describe.skip
    : describe("RGStaking Unit Tests", () => {
          async function deployContractsFixture() {
              const [deployer, account2] = await ethers.getSigners()

              await deployments.fixture()

              const rGToken: RGToken = await ethers.getContract("RGToken", deployer)
              const rGStaking: RGStaking = await ethers.getContract("RGStaking", deployer)

              return { rGToken, rGStaking, deployer, account2 }
          }

          async function initializeRewardsPoolFixture() {
              const result = await loadFixture(deployContractsFixture)

              // Initialize the rewards pool with the REWARD_POOL_TOKEN_AMOUNT
              await initializeRewardPool(result.deployer)

              return result
          }

          async function buyAssetsFixture() {
              const { rGToken, rGStaking, deployer, account2 } = await loadFixture(initializeRewardsPoolFixture)
              const amountOfAssets = 5
              const expectedTokenPrice = parseRGT(amountOfAssets).mul(10)

              // Buy assets by approving and calling the buyAssets function
              await rGToken.approve(rGStaking.address, expectedTokenPrice)
              await rGStaking.buyAssets(amountOfAssets)

              return { rGToken, rGStaking, deployer, amountOfAssets, account2 }
          }

          async function buyAssetsAndWait24hours() {
              const result = await loadFixture(buyAssetsFixture)

              // Fast forward 24 hours
              const currentBlockTimestamp = await time.latest()
              const secondsInADay = time.duration.days(1)
              const nextBlockTimestamp = currentBlockTimestamp + secondsInADay
              const expectedRewardsEarned = parseRGT(result.amountOfAssets / 10)

              // Calculate expected rewards earned after 24 hours
              await time.setNextBlockTimestamp(nextBlockTimestamp)

              return { ...result, expectedRewardsEarned }
          }

          describe("Deployment", () => {
              it("Initializes storage variables correctly", async () => {
                  const { rGStaking, rGToken, deployer, account2 } = await loadFixture(deployContractsFixture)

                  expect(await rGStaking.rGTokenAddress()).to.equal(rGToken.address)
                  expect(await rGStaking.isRewardPoolInitialized()).to.be.false

                  expect(await rGStaking.assetBalance(deployer.address)).to.equal(0)
                  expect(await rGStaking.currentRewardsClaimable(deployer.address)).to.equal(0)

                  expect(await rGStaking.assetBalance(account2.address)).to.equal(0)
                  expect(await rGStaking.currentRewardsClaimable(account2.address)).to.equal(0)

                  expect(await rGStaking.totalRewardPool()).to.equal(TOTAL_REWARD_POOL)
              })
          })

          describe("Initialize rewards pool", () => {
              it("Reverts when already initialized", async () => {
                  const { rGStaking } = await loadFixture(initializeRewardsPoolFixture)

                  // Attempting to initialize the pool again should revert
                  await expect(rGStaking.initializeRewardPool())
                      .to.be.revertedWithCustomError(rGStaking, "RGStaking__AlreadyInitialized")
                      .withArgs()
              })

              it("Sets the initialized boolean to true", async () => {
                  const { rGStaking } = await loadFixture(initializeRewardsPoolFixture)

                  expect(await rGStaking.isRewardPoolInitialized()).to.be.true
              })

              it("Transfers 10,000 tokens from the sender to the staking contract", async () => {
                  const { rGStaking, rGToken, deployer } = await loadFixture(deployContractsFixture)
                  await rGToken.approve(rGStaking.address, TOTAL_REWARD_POOL)

                  // Verify token transfer balances after initializing the reward pool
                  await expect(rGStaking.initializeRewardPool()).to.changeTokenBalances(
                      rGToken,
                      [deployer, rGStaking],
                      [TOTAL_REWARD_POOL.mul(-1), TOTAL_REWARD_POOL]
                  )
              })

              it("Emits RewardPoolInitialized", async () => {
                  const { rGStaking, rGToken, deployer } = await loadFixture(deployContractsFixture)
                  await rGToken.approve(rGStaking.address, TOTAL_REWARD_POOL)

                  // Check the emitted event data after initializing the reward pool
                  await expect(rGStaking.initializeRewardPool())
                      .to.emit(rGStaking, "RewardPoolInitialized")
                      .withArgs(deployer.address, TOTAL_REWARD_POOL)
              })

              it("Reverts if less than 10,000 tokens was approved", async () => {
                  const { rGStaking, rGToken } = await loadFixture(deployContractsFixture)
                  await rGToken.approve(rGStaking.address, TOTAL_REWARD_POOL.sub(100))

                  // Attempting to initialize the pool with insufficient approval should revert
                  await expect(rGStaking.initializeRewardPool()).to.be.revertedWith("ERC20: insufficient allowance")
              })
          })

          describe("Buy assets", () => {
              it("Reverts if rewards pool is uninitialized", async () => {
                  const { rGStaking } = await loadFixture(deployContractsFixture)

                  await expect(rGStaking.buyAssets(1))
                      .to.be.revertedWithCustomError(rGStaking, "RGStaking__Uninitialized")
                      .withArgs()
              })

              it("Reverts if the amount of assets is zero", async () => {
                  const { rGStaking } = await loadFixture(initializeRewardsPoolFixture)

                  await expect(rGStaking.buyAssets(0))
                      .to.be.revertedWithCustomError(rGStaking, "RGStaking__ZeroAmountNotAllowed")
                      .withArgs()
              })

              it("Transfers 10 tokens for every asset bought from the sender to the staking contract", async () => {
                  const { rGStaking, rGToken, deployer } = await loadFixture(initializeRewardsPoolFixture)
                  const amountOfAssets = 5
                  const expectedTokenPrice = parseRGT(amountOfAssets).mul(10)

                  await rGToken.approve(rGStaking.address, expectedTokenPrice)

                  await expect(rGStaking.buyAssets(amountOfAssets)).to.changeTokenBalances(
                      rGToken,
                      [deployer, rGStaking],
                      [expectedTokenPrice.mul(-1), expectedTokenPrice]
                  )
              })

              it("Increases the assets of the sender by the amount bought", async () => {
                  const { rGStaking, rGToken, deployer } = await loadFixture(initializeRewardsPoolFixture)
                  const amountOfAssets = 5
                  const expectedTokenPrice = parseRGT(amountOfAssets).mul(10)
                  await rGToken.approve(rGStaking.address, expectedTokenPrice)

                  const initialAssets = await rGStaking.assetBalance(deployer.address)
                  await rGStaking.buyAssets(amountOfAssets)

                  const finalAssets = await rGStaking.assetBalance(deployer.address)
                  expect(finalAssets.sub(initialAssets)).to.equal(amountOfAssets)
              })

              it("Emits the AssetsBought event with sender and amount bought", async () => {
                  const { rGStaking, rGToken, deployer } = await loadFixture(initializeRewardsPoolFixture)
                  const amountOfAssets = 5
                  const expectedTokenPrice = parseRGT(amountOfAssets).mul(10)
                  await rGToken.approve(rGStaking.address, expectedTokenPrice)

                  await expect(rGStaking.buyAssets(amountOfAssets))
                      .to.emit(rGStaking, "AssetsBought")
                      .withArgs(deployer.address, amountOfAssets)
              })
          })

          describe("Redeem assets", () => {
              it("Reverts when the amount of assets is zero", async () => {
                  const { rGStaking } = await loadFixture(deployContractsFixture)

                  await expect(rGStaking.redeemAssets(0))
                      .to.be.revertedWithCustomError(rGStaking, "RGStaking__ZeroAmountNotAllowed")
                      .withArgs()
              })

              it("Reverts when the sender attempts to redeem more assets than owned", async () => {
                  const { rGStaking, amountOfAssets: availableAssets } = await loadFixture(buyAssetsFixture)
                  const assetsToRedeem = availableAssets + 1

                  await expect(rGStaking.redeemAssets(assetsToRedeem))
                      .to.be.revertedWithCustomError(rGStaking, "RGStaking__InsufficientAssets")
                      .withArgs(availableAssets, assetsToRedeem)
              })

              it("Reduces assets of the sender by amount redeemed", async () => {
                  const { rGStaking, deployer, amountOfAssets: initialAssets } = await loadFixture(buyAssetsFixture)
                  const amountToRedeem = 3

                  await rGStaking.redeemAssets(amountToRedeem)

                  const finalAssets = await rGStaking.assetBalance(deployer.address)
                  expect(finalAssets).to.equal(initialAssets - amountToRedeem)
              })

              it("Transfers 10 tokens for every asset sold from the staking contract to the sender", async () => {
                  const { rGStaking, rGToken, deployer } = await loadFixture(buyAssetsFixture)
                  const amountToRedeem = 3
                  const expectedTokenPrice = parseRGT(amountToRedeem).mul(10)

                  await expect(rGStaking.redeemAssets(amountToRedeem)).to.changeTokenBalances(
                      rGToken,
                      [deployer, rGStaking],
                      [expectedTokenPrice, expectedTokenPrice.mul(-1)]
                  )
              })

              it("Emits the AssetsRedeemed event with sender and amount redeemed", async () => {
                  const { rGStaking, deployer } = await loadFixture(buyAssetsFixture)
                  const amountToRedeem = 3

                  await expect(rGStaking.redeemAssets(amountToRedeem))
                      .to.emit(rGStaking, "AssetsRedeemed")
                      .withArgs(deployer.address, amountToRedeem)
              })
          })

          describe("Redeem rewards", () => {
              it("Reverts when the sender hasn't earned any rewards", async () => {
                  const { rGStaking } = await loadFixture(initializeRewardsPoolFixture)

                  await expect(rGStaking.claimRewards())
                      .to.be.revertedWithCustomError(rGStaking, "RGStaking__NoRewardsForSender")
                      .withArgs()
              })

              it("Sets the sender's rewards to zero", async () => {
                  const { rGStaking, deployer } = await loadFixture(buyAssetsAndWait24hours)

                  await rGStaking.claimRewards()

                  const finalRewardBalance = await rGStaking.currentRewardsClaimable(deployer.address)
                  expect(finalRewardBalance).to.equal(0)
              })

              it("Transfers the amount earned to the sender", async () => {
                  const { rGStaking, rGToken, expectedRewardsEarned, deployer } = await loadFixture(
                      buyAssetsAndWait24hours
                  )

                  await expect(rGStaking.claimRewards()).to.changeTokenBalances(
                      rGToken,
                      [deployer, rGStaking],
                      [expectedRewardsEarned, expectedRewardsEarned.mul(-1)]
                  )
              })

              it("Emits the RewardsClaimed event with the sender address and rewards withdrawn", async () => {
                  const { rGStaking, expectedRewardsEarned, deployer } = await loadFixture(buyAssetsAndWait24hours)

                  await expect(rGStaking.claimRewards())
                      .to.emit(rGStaking, "RewardsClaimed")
                      .withArgs(deployer.address, expectedRewardsEarned)
              })
          })

          describe("Update rewards", () => {
              it("Prevents further earning of rewards if the reward pool is empty", async () => {
                  const { rGStaking } = await loadFixture(buyAssetsAndWait24hours)

                  // Fast forward 20,000 days to claim the entire reward pool
                  const totalSeconds = time.duration.days(20_000)
                  const nextBlockTimestamp = (await time.latest()) + totalSeconds
                  await time.setNextBlockTimestamp(nextBlockTimestamp)
                  await rGStaking.claimRewards()

                  // The reward pool is now empty
                  expect(await rGStaking.totalRewardPool()).to.equal(0)

                  // Fast forward one more day
                  const secondsInADay = time.duration.days(1)
                  const nextDayBlockTimestamp = nextBlockTimestamp + secondsInADay
                  await time.setNextBlockTimestamp(nextDayBlockTimestamp)

                  // Try to claim rewards again, it should revert
                  await expect(rGStaking.claimRewards())
                      .to.be.revertedWithCustomError(rGStaking, "RGStaking__NoRewardsForSender")
                      .withArgs()
              })

              it("Caps the maximum reward earned to the remaining reward pool", async () => {
                  const { rGStaking, rGToken, deployer } = await loadFixture(buyAssetsAndWait24hours)

                  // Fast forward a lot of years, the rewards pool should be depleted at 20,000 days, however, we shouldn't get
                  // more tokens, we should just get the entire pool.
                  const totalSeconds = time.duration.years(100_000)
                  const nextBlockTimestamp = (await time.latest()) + totalSeconds
                  await time.setNextBlockTimestamp(nextBlockTimestamp)

                  await expect(rGStaking.claimRewards()).to.changeTokenBalances(
                      rGToken,
                      [deployer, rGStaking],
                      [TOTAL_REWARD_POOL, TOTAL_REWARD_POOL.mul(-1)]
                  )

                  expect(await rGStaking.totalRewardPool()).to.equal(0)

                  const secondsInADay = time.duration.days(1)
                  const nextDayBlockTimestamp = nextBlockTimestamp + secondsInADay
                  await time.setNextBlockTimestamp(nextDayBlockTimestamp)

                  // Try to claim rewards again, it should revert
                  await expect(rGStaking.claimRewards())
                      .to.be.revertedWithCustomError(rGStaking, "RGStaking__NoRewardsForSender")
                      .withArgs()
              })
          })
      })
