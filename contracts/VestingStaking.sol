pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

import "./Token.sol";
import "./VestingStrategy.sol";

contract VestingStaking is AccessControl {
    bytes32 public constant OWNER_ROLE = keccak256("OWNER_ROLE");
    bytes32 public constant WHITELISTED_ROLE = keccak256("WHITELISTED_ROLE");

    State public state;

    enum State {
        Created,
        Started
    }

    enum VestingType {
        FIRST_TYPE_VESTING,
        SECOND_TYPE_VESTING
    }

    mapping (VestingType => address) vestings;

    uint256 public totalValueLocked;

    uint256 public startTime;


    struct UserInfo {
        uint256 stakedBalance;
        uint256 alredyWithdrawed;
        VestingType vestingContract;
        uint256 startTime;
        uint256 reward;
        uint256 rewardPerTokenPaid;
    }

    struct UserInitInfo {
        address account;
        uint256 staked;
        VestingType vestingType;
    }

    struct StakeInfo {
        address rewardTokenAddress;
        uint256 rewardPool;
        uint256 lastUpdateTime;
        uint256 rewardPerTokenStored;
    }

    StakeInfo public stakeInfo;

    uint256 public rewardPerDay;

    mapping (address => UserInfo) accountStaking;

    constructor(address tokenAddress_) {
        _setupRole(OWNER_ROLE, msg.sender);
        _setRoleAdmin(WHITELISTED_ROLE, OWNER_ROLE);
        stakeInfo.rewardTokenAddress = tokenAddress_;
        state = State.Created;
    }
    
    modifier onlyState(State state_) {
        require(state == state_, "function cannot be called in this contract state");
        _;
    }

    modifier userStaking() {
        require(accountStaking[msg.sender].alredyWithdrawed < accountStaking[msg.sender].stakedBalance, "user isn't staking");
        _;
    }

    modifier userNotStaking() {
        require(accountStaking[msg.sender].alredyWithdrawed == accountStaking[msg.sender].stakedBalance, "user is staking");
        _;
    }

    modifier updateReward() {
        stakeInfo.rewardPerTokenStored = _rewardPerToken();
        stakeInfo.lastUpdateTime = block.timestamp;
        accountStaking[msg.sender].reward = earned();
        accountStaking[msg.sender].rewardPerTokenPaid = stakeInfo.rewardPerTokenStored;
        _;
    }

    function stake(uint256 amount, VestingType vestingStrategy) public onlyState(State.Started) onlyRole(WHITELISTED_ROLE) userNotStaking updateReward {
        require(amount > 0, "amount is 0");
        require(Token(stakeInfo.rewardTokenAddress).balanceOf(msg.sender) >= amount, "sender doesn't have that amount of tokens on balance");
        require(Token(stakeInfo.rewardTokenAddress).allowance(msg.sender, address(this)) >= amount, "contract can't spend that amount of tokens");
        accountStaking[msg.sender].vestingContract = vestingStrategy;
        accountStaking[msg.sender].stakedBalance = amount;
        accountStaking[msg.sender].startTime = block.timestamp;
        accountStaking[msg.sender].alredyWithdrawed = 0;
        totalValueLocked += amount;
        Token(stakeInfo.rewardTokenAddress).transferFrom(msg.sender, address(this), amount);
    } 

    function withdraw(uint256 amount) public onlyState(State.Started) onlyRole(WHITELISTED_ROLE) userStaking updateReward {
        UserInfo storage info = accountStaking[msg.sender];
        if (info.startTime == 0) {
            info.startTime = startTime;
        }
        uint256 left = claimLeft();
        require(amount <= left, "can't withdraw that amount of tokens");
        info.alredyWithdrawed += left;
        totalValueLocked -= left;
        Token(stakeInfo.rewardTokenAddress).transfer(msg.sender, amount);
    }

    function calculateAPYStaked() public view onlyState(State.Started) onlyRole(WHITELISTED_ROLE) userStaking returns (uint256) {
        return rewardPerDay * 365 * 100 / (totalValueLocked);
    }

    function calculateAPYNotStaked(uint256 staked_) public view onlyState(State.Started) onlyRole(WHITELISTED_ROLE) userNotStaking returns (uint256) {
        return rewardPerDay * 365 * 100 / (totalValueLocked + staked_);
    }

    function claimLeft() public view onlyState(State.Started) onlyRole(WHITELISTED_ROLE) userStaking returns (uint256) {
        UserInfo storage staker = accountStaking[msg.sender];
        return VestingStrategy(vestings[staker.vestingContract]).calculate(staker.startTime, staker.stakedBalance) - staker.alredyWithdrawed;
    }

    function getTVL() public view onlyState(State.Started) onlyRole(WHITELISTED_ROLE) returns (uint256) {
        return totalValueLocked;
    }

    function getFullAmountOfTokens() public view onlyState(State.Started) onlyRole(WHITELISTED_ROLE) returns (uint256) {
        return Token(stakeInfo.rewardTokenAddress).totalSupply();
    }

    function earned() public view onlyState(State.Started) onlyRole(WHITELISTED_ROLE) returns (uint256) {
        UserInfo storage userInfo = accountStaking[msg.sender];
        return userInfo.stakedBalance * (_rewardPerToken() - userInfo.rewardPerTokenPaid) / 1e18 + userInfo.reward;
    }

    function getReward() public onlyState(State.Started) onlyRole(WHITELISTED_ROLE) updateReward {
        UserInfo storage userInfo = accountStaking[msg.sender];
        uint256 reward = userInfo.reward;
        require(stakeInfo.rewardPool >= reward, "reward pool less than reward");
        if (reward > 0) {
            userInfo.reward = 0;
            stakeInfo.rewardPool -= reward;
            Token(stakeInfo.rewardTokenAddress).transfer(msg.sender, reward);
        }
    }

    function start(uint256 rewardPerDay_, uint256 rewardPoolInitial) public onlyState(State.Created) onlyRole(OWNER_ROLE) {
        rewardPerDay = rewardPerDay_;
        startTime = block.timestamp;
        state = State.Started;
        stakeInfo.rewardPool = rewardPoolInitial;
    }

    function initUsers(UserInitInfo[] calldata users) public onlyState(State.Created) onlyRole(OWNER_ROLE) {
        require(users.length <= 10, "length > 10");
        for (uint256 i = 0; i < users.length; i++) {
            addToWhitelist(users[i].account);
            accountStaking[users[i].account].stakedBalance = users[i].staked;
            accountStaking[users[i].account].vestingContract = users[i].vestingType;
            accountStaking[users[i].account].alredyWithdrawed = 0;
            Token(stakeInfo.rewardTokenAddress).transferFrom(users[i].account, address(this), users[i].staked);
            totalValueLocked += users[i].staked;
        }
    }

    function increaseRewardPool(uint256 reward_) public onlyState(State.Started) onlyRole(OWNER_ROLE) {
        stakeInfo.rewardPool += reward_;
    }

    function initVestingStrategies(address firstVestingStrategy, address secondVestingStrategy) public onlyState(State.Created) onlyRole(OWNER_ROLE) {
        vestings[VestingType.FIRST_TYPE_VESTING] = firstVestingStrategy;
        vestings[VestingType.SECOND_TYPE_VESTING] = secondVestingStrategy;
    }

     function addToWhitelist(address account) public onlyRole(OWNER_ROLE) {
        require(hasRole(WHITELISTED_ROLE, account) == false, "account already whitelisted");
        grantRole(WHITELISTED_ROLE, account);
    }

    function removeFromWhiteList(address account) public onlyRole(OWNER_ROLE) {
        require(hasRole(WHITELISTED_ROLE, account) == true, "account not whitelisted");
        revokeRole(WHITELISTED_ROLE, account);
    }

    function _rewardPerToken() internal view returns (uint256) {
        if (totalValueLocked == 0) {
            return stakeInfo.rewardPerTokenStored;
        }
        return stakeInfo.rewardPerTokenStored + (block.timestamp - stakeInfo.lastUpdateTime) * rewardPerDay * 1e18 / totalValueLocked / 1 days;
    }
}