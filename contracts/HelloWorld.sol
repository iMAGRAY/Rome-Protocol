// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

/**
 * @title HelloWorld
 * @dev Simple smart contract for Rome Protocol testnet deployment
 * @author Rome Protocol Automation Bot
 */
contract HelloWorld {
    string public greet;
    address public owner;
    uint256 public deploymentBlock;
    uint256 public interactionCount;
    mapping(address => uint256) public userInteractions;
    string[] public messageHistory;
    
    event GreetingChanged(string newGreeting, address changedBy, uint256 timestamp);
    event ContractInteraction(address user, uint256 count, uint256 timestamp);
    event MessageStored(string message, address sender, uint256 timestamp);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }
    
    /**
     * @dev Constructor sets initial greeting and owner
     */
    constructor() {
        greet = "Hello, World!";
        owner = msg.sender;
        deploymentBlock = block.number;
        interactionCount = 0;
    }
    
    /**
     * @dev Returns the current greeting
     * @return Current greeting string
     */
    function getGreeting() public view returns (string memory) {
        return greet;
    }
    
    /**
     * @dev Sets a new greeting message
     * @param _greeting New greeting message
     */
    function setGreeting(string memory _greeting) public {
        require(bytes(_greeting).length > 0, "Greeting cannot be empty");
        require(bytes(_greeting).length <= 200, "Greeting too long");
        
        greet = _greeting;
        interactionCount++;
        userInteractions[msg.sender]++;
        
        emit GreetingChanged(_greeting, msg.sender, block.timestamp);
        emit ContractInteraction(msg.sender, interactionCount, block.timestamp);
    }
    
    /**
     * @dev Store a message in history
     * @param _message Message to store
     */
    function storeMessage(string memory _message) public {
        require(bytes(_message).length > 0, "Message cannot be empty");
        require(bytes(_message).length <= 100, "Message too long");
        
        messageHistory.push(_message);
        interactionCount++;
        userInteractions[msg.sender]++;
        
        emit MessageStored(_message, msg.sender, block.timestamp);
        emit ContractInteraction(msg.sender, interactionCount, block.timestamp);
    }
    
    /**
     * @dev Get message from history
     * @param index Index of message
     * @return Message at index
     */
    function getMessage(uint256 index) public view returns (string memory) {
        require(index < messageHistory.length, "Index out of bounds");
        return messageHistory[index];
    }
    
    /**
     * @dev Get total number of stored messages
     * @return Number of messages
     */
    function getMessageCount() public view returns (uint256) {
        return messageHistory.length;
    }
    
    /**
     * @dev Returns contract deployment information
     * @return deployBlock Block number when contract was deployed
     * @return contractOwner Address of contract owner
     * @return interactions Total number of interactions
     */
    function getContractInfo() public view returns (
        uint256 deployBlock,
        address contractOwner,
        uint256 interactions
    ) {
        return (deploymentBlock, owner, interactionCount);
    }
    
    /**
     * @dev Increment interaction counter (gas-efficient interaction)
     */
    function ping() public {
        interactionCount++;
        userInteractions[msg.sender]++;
        emit ContractInteraction(msg.sender, interactionCount, block.timestamp);
    }
    
    /**
     * @dev Batch ping for efficient mass interactions
     * @param count Number of pings to execute
     */
    function batchPing(uint256 count) public {
        require(count > 0 && count <= 100, "Count must be between 1 and 100");
        
        for (uint256 i = 0; i < count; i++) {
            interactionCount++;
        }
        
        userInteractions[msg.sender] += count;
        emit ContractInteraction(msg.sender, interactionCount, block.timestamp);
    }
    
    /**
     * @dev Random number generator (for demo purposes)
     * @return pseudo-random number
     */
    function getRandomNumber() public view returns (uint256) {
        return uint256(keccak256(abi.encodePacked(
            block.timestamp,
            block.prevrandao,
            msg.sender,
            interactionCount
        ))) % 1000;
    }
    
    /**
     * @dev Toggle greeting between predefined messages
     */
    function toggleGreeting() public {
        string[5] memory greetings = [
            "Hello, World!",
            "Hello Rome Protocol!",
            "Greetings from blockchain!",
            "Random activity in progress",
            "Testing smart contracts"
        ];
        
        uint256 randomIndex = getRandomNumber() % greetings.length;
        greet = greetings[randomIndex];
        
        interactionCount++;
        userInteractions[msg.sender]++;
        
        emit GreetingChanged(greet, msg.sender, block.timestamp);
        emit ContractInteraction(msg.sender, interactionCount, block.timestamp);
    }
    
    /**
     * @dev Set owner (only current owner)
     * @param newOwner New owner address
     */
    function setOwner(address newOwner) public onlyOwner {
        require(newOwner != address(0), "New owner cannot be zero address");
        owner = newOwner;
    }
    
    /**
     * @dev Get current block information
     * @return blockNumber Current block number
     * @return blockTimestamp Current block timestamp
     * @return blockDifficulty Current block difficulty
     */
    function getBlockInfo() public view returns (
        uint256 blockNumber,
        uint256 blockTimestamp,
        uint256 blockDifficulty
    ) {
        return (block.number, block.timestamp, block.prevrandao);
    }
    
    /**
     * @dev Emergency function to reset greeting to default
     */
    function resetGreeting() public onlyOwner {
        greet = "Hello, World!";
        interactionCount++;
        
        emit GreetingChanged("Hello, World!", msg.sender, block.timestamp);
        emit ContractInteraction(msg.sender, interactionCount, block.timestamp);
    }
    
    /**
     * @dev View function that returns multiple contract states
     * @return greeting Current greeting
     * @return contractOwner Contract owner
     * @return totalInteractions Total interactions
     * @return currentBlock Current block number
     */
    function getFullState() public view returns (
        string memory greeting,
        address contractOwner,
        uint256 totalInteractions,
        uint256 currentBlock
    ) {
        return (greet, owner, interactionCount, block.number);
    }
    
    /**
     * @dev Get user interaction count
     * @param user User address
     * @return Number of interactions by user
     */
    function getUserInteractions(address user) public view returns (uint256) {
        return userInteractions[user];
    }
    
    /**
     * @dev Receive function for ETH deposits (not used but good practice)
     */
    receive() external payable {
        interactionCount++;
        userInteractions[msg.sender]++;
        emit ContractInteraction(msg.sender, interactionCount, block.timestamp);
    }
    
    /**
     * @dev Fallback function
     */
    fallback() external payable {
        interactionCount++;
        userInteractions[msg.sender]++;
        emit ContractInteraction(msg.sender, interactionCount, block.timestamp);
    }
}