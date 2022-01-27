const { expect } = require("chai");
const { ethers } = require("hardhat");


describe("Vesting Strategy test", function () {
  let account, VestingStrategy, firstVestingStrategy, secondVestingStrategy, beginTimestamp = Date.now();
  beforeEach(async () => {
    [account] = await ethers.getSigners();
    VestingStrategy = await ethers.getContractFactory("VestingStrategy");
    firstVestingStrategy = await VestingStrategy.deploy(15, 30);
    await firstVestingStrategy.deployed();
  });
  it("calculate test", async function () {
    expect(await firstVestingStrategy.calculate(beginTimestamp, 10)).to.equal(0);
    expect(await firstVestingStrategy.calculate(beginTimestamp, 10)).to.equal(0);
  });
});
