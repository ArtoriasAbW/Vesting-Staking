pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

import "./Token.sol";
import "./IVestingStrategy.sol";
import "./VestingStrategy.sol";

contract VestingStaking is AccessControl {
    bytes32 public constant OWNER_ROLE = keccak256("OWNER_ROLE");
    bytes32 public constant WHITELISTED_ROLE = keccak256("WHITELISTED_ROLE");

    State public state;

    uint256 public rewardPool;
    uint256 public totalValueLocked;
    

    struct stakingInfo {
        uint256 stakedBalance;
        uint256 alredyWithdrawed;
        address vestingContract;
        uint256 startTime;
    }

    mapping (address => stakingInfo) accountStaking;

    enum State {
        Created,
        Started
    }

    address public rewardTokenAddress;
    address public VestingStrategyAddress;


    uint256 private initialStakeSize;
    
    constructor(address tokenAddress_) {
        _setupRole(OWNER_ROLE, msg.sender);
        _setRoleAdmin(WHITELISTED_ROLE, OWNER_ROLE);
        rewardTokenAddress = tokenAddress_;
        state = State.Created;
    }
    
    modifier onlyState(State state_) {
        require(state == state_);
        _;
    }

    // можно создать отдельную функцию для добавления в whitelist, принимающую массив, но нужно как-то ограничить размер массиваx

    function start() public onlyState(State.Created) onlyRole(OWNER_ROLE)  returns (bool, uint256) { // (started, last index of whitelist account)

    }

    // нужно конкретному пользователю
    function setInitialAllocation(uint256 allocaltion_) public onlyState(State.Created) onlyRole(OWNER_ROLE)  {
        initialStakeSize = allocaltion_;
    }

    // нужно конкретному пользователю
    function setInitialReward(uint256 initialReward_) public onlyState(State.Created) onlyRole(OWNER_ROLE) {
        rewardPool = initialReward_;
    }

    // ok
    function addExtraReward(uint256 reward_) public onlyState(State.Started) onlyRole(OWNER_ROLE) {
        rewardPool += reward_;
    }


    function stake(uint256 amount) public onlyState(State.Started) onlyRole(WHITELISTED_ROLE) {
        require(Token(rewardTokenAddress).balanceOf(msg.sender) >= amount, "sender doesn't have that amount of tokens on balance");
        require(Token(rewardTokenAddress).allowance(msg.sender, address(this)) >= amount, "contract can't spend that amount of tokens");
    } 

    // хз
    function getReward() public onlyState(State.Started) onlyRole(WHITELISTED_ROLE) {

    }

    // снятие стейка, получение наград
    function withdraw(uint256 amount) public onlyState(State.Started) onlyRole(WHITELISTED_ROLE) {

    }
    
    // ok
    function addToWhitelist(address account) public onlyRole(OWNER_ROLE) {
        require(hasRole(WHITELISTED_ROLE, account) == false, "Account already whitelisted");
        grantRole(WHITELISTED_ROLE, account);
    }
    // ok
    function removeFromWhiteList(address account) public onlyRole(OWNER_ROLE) {
        require(hasRole(WHITELISTED_ROLE, account) == true, "Account not whitelisted");
        revokeRole(WHITELISTED_ROLE, account);
    }

    // ok
    function _setVestingStrategy(address account, address vestringStrategy) internal onlyRole(OWNER_ROLE) {
        accountStaking[account].vestingContract = vestringStrategy;
    }
}