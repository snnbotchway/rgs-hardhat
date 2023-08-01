// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";

error RGStaking__AlreadyInitialized();
error RGStaking__InsufficientAssets(uint256 availableAssets, uint256 requestedAssets);
error RGStaking__NoRewardsForSender();
error RGStaking__Uninitialized();
error RGStaking__ZeroAmountNotAllowed();

/**
 * @title RGStaking
 * @author Solomon Botchway @snnbotchway
 * @dev A contract for staking assets and earning rewards in RGT tokens.
 */
contract RGStaking {
    IERC20 private immutable i_rGToken;

    struct UserData {
        uint256 assets;
        uint256 rewards;
        uint256 lastUpdateTime;
    }
    mapping(address => UserData) private s_userData;

    bool private s_rewardPoolInitialized;
    uint256 private s_totalRewardPool;

    uint256 private constant ONE_TOKEN = 1e18;
    uint256 private constant DAILY_REWARDS_PER_ASSET = ONE_TOKEN / 10;
    uint256 private constant TOKENS_PER_ASSET = ONE_TOKEN * 10;

    /**
     * @dev Emitted when the reward pool is initialized with tokens.
     * @param sender The address that initialized the reward pool.
     * @param amount The amount of RGT tokens added to the reward pool.
     */
    event RewardPoolInitialized(address indexed sender, uint256 amount);

    /**
     * @dev Emitted when a user buys assets.
     * @param user The address of the user who bought assets.
     * @param assetsBought The amount of assets bought.
     */
    event AssetsBought(address indexed user, uint256 assetsBought);

    /**
     * @dev Emitted when a user redeems assets.
     * @param user The address of the user who redeemed assets.
     * @param assetsRedeemed The amount of assets redeemed.
     */
    event AssetsRedeemed(address indexed user, uint256 assetsRedeemed);

    /**
     * @dev Emitted when a user withdraws rewards.
     * @param user The address of the user who withdrew rewards.
     * @param rewardWithdrawn The amount of rewards withdrawn.
     */
    event RewardsClaimed(address indexed user, uint256 rewardWithdrawn);

    /**
     * @param _rGTokenAddress The address of the deployed RGToken.
     */
    constructor(address _rGTokenAddress) {
        i_rGToken = IERC20(_rGTokenAddress);
        s_totalRewardPool = 10000 * ONE_TOKEN;
    }

    /**
     * @dev Calculates the additional rewards earned by the specified account since the last update.
     * The rewards are calculated based on the time passed and the number of assets owned by the account since the last update.
     * @param account The address of the account for which to calculate additional rewards.
     * @return The additional rewards earned by the account.
     *
     * Formula: ((currentTime - lastUpdateTime) * assets * dailyRewardsPerAsset) / secondsInADay
     * Since rewards per asset for a duration of 1 day is 0.1, DAILY_REWARDS_PER_ASSET = ONE_TOKEN * 0.1 or DAILY_REWARDS_PER_ASSET = ONE_TOKEN / 10.
     * This formula computes the additional rewards for the user's assets within the given time duration.
     *
     * For example, if the user has 4 assets (each asset represents 10 tokens) and 24 hours have passed since the last update:
     * Additional Rewards = ((24 hours * 3600 seconds) * 4 assets * 1e17) / (24 hours * 3600 seconds) = 0.4 * 1e18 RGT tokens
     *
     * If the total reward pool is less than the additional reward, then we return the total reward pool as the additional reward
     * since the pool is depleted. When it finishes completely, this function will always return 0. This ensures exactly the
     * amount specified in the pool is given out as rewards.
     */
    function calculateAdditionalRewards(address account) private view returns (uint256) {
        UserData memory userData = s_userData[account];

        uint256 additionalRewards = ((block.timestamp - userData.lastUpdateTime) *
            userData.assets *
            DAILY_REWARDS_PER_ASSET) / 1 days;

        return additionalRewards < s_totalRewardPool ? additionalRewards : s_totalRewardPool;
    }

    /**
     * @dev Modifier to update rewards for the specified account before function execution.
     * It calculates the additional rewards earned by the account since the last update.
     * @param account The address of the account to update rewards for.
     */
    modifier updateRewards(address account) {
        uint256 additionalRewards = calculateAdditionalRewards(account);

        UserData storage userData = s_userData[account];
        userData.lastUpdateTime = block.timestamp;
        userData.rewards += additionalRewards;
        s_totalRewardPool -= additionalRewards;

        _;
    }

    /**
     * @dev Initializes the reward pool by transferring a specific amount of RGT tokens to the contract.
     * This function can only be called once to set up the reward pool before users can interact with the contract.
     *
     * Requirements:
     * - The reward pool must not be already initialized to prevent double initialization.
     *
     * Effects:
     * - Transfers the specified amount of RGT tokens from the sender's address to the contract, creating the reward pool.
     * - Emits a `RewardPoolInitialized` event with information about the sender and the amount of tokens added to the reward pool.
     *
     * Once the reward pool is initialized, users can start buying assets and earning rewards.
     */
    function initializeRewardPool() external {
        if (s_rewardPoolInitialized) revert RGStaking__AlreadyInitialized();

        s_rewardPoolInitialized = true;

        i_rGToken.transferFrom(msg.sender, address(this), s_totalRewardPool);

        emit RewardPoolInitialized(msg.sender, s_totalRewardPool);
    }

    /**
     * @dev Allows users to buy assets by transferring RGT tokens to the contract.
     * @notice The reward pool must be initialized before users can buy assets.
     * @param amountOfAssets The amount of assets to buy. The price of one asset is 10 tokens.
     */
    function buyAssets(uint256 amountOfAssets) external updateRewards(msg.sender) {
        if (!s_rewardPoolInitialized) revert RGStaking__Uninitialized();
        if (amountOfAssets == 0) revert RGStaking__ZeroAmountNotAllowed();

        i_rGToken.transferFrom(msg.sender, address(this), getAssetPriceInTokens(amountOfAssets));

        UserData storage userData = s_userData[msg.sender];
        userData.assets += amountOfAssets;

        emit AssetsBought(msg.sender, amountOfAssets);
    }

    /**
     * @dev Allows users to redeem assets by transferring RGT tokens from the contract to the user.
     * @param amountOfAssets The amount of assets to redeem. The price of one asset is 10 tokens.
     */
    function redeemAssets(uint256 amountOfAssets) external updateRewards(msg.sender) {
        UserData storage userData = s_userData[msg.sender];

        if (amountOfAssets == 0) revert RGStaking__ZeroAmountNotAllowed();
        if (userData.assets < amountOfAssets) revert RGStaking__InsufficientAssets(userData.assets, amountOfAssets);

        userData.assets -= amountOfAssets;

        i_rGToken.transfer(msg.sender, getAssetPriceInTokens(amountOfAssets));

        emit AssetsRedeemed(msg.sender, amountOfAssets);
    }

    /**
     * @dev Allows users to withdraw their earned rewards in RGT tokens.
     */
    function claimRewards() external updateRewards(msg.sender) {
        UserData storage userData = s_userData[msg.sender];
        uint256 rewards = userData.rewards;

        if (rewards == 0) revert RGStaking__NoRewardsForSender();

        userData.rewards = 0;

        i_rGToken.transfer(msg.sender, rewards);

        emit RewardsClaimed(msg.sender, rewards);
    }

    function rGTokenAddress() external view returns (address) {
        return address(i_rGToken);
    }

    function isRewardPoolInitialized() external view returns (bool) {
        return s_rewardPoolInitialized;
    }

    function currentRewardsClaimable(address account) external view returns (uint256) {
        return s_userData[account].rewards + calculateAdditionalRewards(account);
    }

    function assetBalance(address account) external view returns (uint256) {
        return s_userData[account].assets;
    }

    function totalRewardPool() external view returns (uint256) {
        return s_totalRewardPool;
    }

    /**
     * @dev Get the price of a certain number of assets in RGT tokens.
     * @param amountOfAssets The amount of assets for which you want the price.
     */
    function getAssetPriceInTokens(uint256 amountOfAssets) private pure returns (uint256) {
        return amountOfAssets * TOKENS_PER_ASSET;
    }
}
