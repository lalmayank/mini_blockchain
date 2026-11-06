import os
import json
import solcx
from web3 import Web3

CONTRACT_SOURCE_PATH = os.path.join("blockchain", "contracts", "FraudAudit.sol")
DEPLOY_INFO_PATH = os.path.join("blockchain", "contract_deploy.json")

def load_env_vars():
    env_vars = {}
    if os.path.exists(".env"):
        with open(".env", "r") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    env_vars[k.strip()] = v.strip()
    return env_vars

def deploy_to_sepolia():
    print("=" * 65)
    print(" [CrossBank TrustFL] Ethereum Sepolia Smart Contract Deployer")
    print("=" * 65)

    env = load_env_vars()
    rpc_url = env.get("SEPOLIA_RPC_URL", "https://ethereum-sepolia-rpc.publicnode.com")
    coord_key = env.get("COORDINATOR_PRIVATE_KEY", "")
    bank_a = env.get("BANK_A_ADDRESS", "")
    bank_b = env.get("BANK_B_ADDRESS", "")
    bank_c = env.get("BANK_C_ADDRESS", "")
    required_approvals = int(env.get("REQUIRED_APPROVALS", "2"))

    w3 = Web3(Web3.HTTPProvider(rpc_url))
    if not w3.is_connected():
        print(f"[X] Failed to connect to Sepolia RPC at: {rpc_url}")
        return

    print(f"Connected to Sepolia Testnet (Block #{w3.eth.block_number})")

    if not coord_key:
        print("[X] Missing COORDINATOR_PRIVATE_KEY in .env file.")
        return

    account = w3.eth.account.from_key(coord_key)
    balance_wei = w3.eth.get_balance(account.address)
    balance_eth = w3.from_wei(balance_wei, "ether")
    print(f"Deployer Account: {account.address}")
    print(f"Account Balance:  {balance_eth:.6f} Sepolia ETH")

    if balance_wei == 0:
        print("\n[!] ACCOUNT HAS 0 ETH.")
        print(f"Please send at least 0.02 Sepolia ETH to: {account.address}")
        print("Free faucets:")
        print(" - https://cloud.google.com/application/web3/faucet/ethereum/sepolia")
        print(" - https://sepoliafaucet.com/")
        print(" - https://sepolia-faucet.pk910.de/\n")
        return

    # Compile contract
    print("\nCompiling FraudAudit.sol with solc 0.8.20...")
    solcx.set_solc_version("0.8.20")
    compiled = solcx.compile_files([CONTRACT_SOURCE_PATH], output_values=["abi", "bin"])
    contract_key = [k for k in compiled.keys() if k.endswith(":FraudAudit")][0]
    abi = compiled[contract_key]["abi"]
    bytecode = compiled[contract_key]["bin"]

    FraudAuditFactory = w3.eth.contract(abi=abi, bytecode=bytecode)
    constructor_args = [
        bank_a if Web3.is_address(bank_a) else account.address,
        bank_b if Web3.is_address(bank_b) else account.address,
        bank_c if Web3.is_address(bank_c) else account.address,
        required_approvals
    ]

    print(f"Constructing transaction with initial banks:\n  Bank A: {constructor_args[0]}\n  Bank B: {constructor_args[1]}\n  Bank C: {constructor_args[2]}")
    nonce = w3.eth.get_transaction_count(account.address)
    gas_price = w3.eth.gas_price

    tx = FraudAuditFactory.constructor(*constructor_args).build_transaction({
        "from": account.address,
        "nonce": nonce,
        "gas": 3500000,
        "gasPrice": gas_price
    })

    print("Signing deployment transaction...")
    signed_tx = w3.eth.account.sign_transaction(tx, coord_key)
    print("Broadcasting transaction to Ethereum Sepolia...")
    tx_hash = w3.eth.send_raw_transaction(signed_tx.raw_transaction)
    print(f"Transaction Hash: {tx_hash.hex()}")
    print("Waiting for block confirmation (~12 seconds)...")

    receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
    contract_address = receipt.contractAddress

    print("\n" + "=" * 65)
    print(" CONTRACT SUCCESSFULLY DEPLOYED TO SEPOLIA TESTNET!")
    print("=" * 65)
    print(f" Contract Address: {contract_address}")
    print(f" Block Number:     {receipt.blockNumber}")
    print(f" Gas Used:         {receipt.gasUsed:,} units")
    print(f" View on Explorer: https://sepolia.etherscan.io/address/{contract_address}")
    print("=" * 65 + "\n")

    deploy_data = {
        "address": contract_address,
        "deployer": account.address,
        "abi": abi,
        "block_number": receipt.blockNumber,
        "network": "Ethereum Sepolia Testnet",
        "chain_id": 11155111,
        "bank_a": constructor_args[0],
        "bank_b": constructor_args[1],
        "bank_c": constructor_args[2],
        "required_approvals": required_approvals,
        "etherscan_url": f"https://sepolia.etherscan.io/address/{contract_address}"
    }

    with open(DEPLOY_INFO_PATH, "w") as f:
        json.dump(deploy_data, f, indent=2)

    print(f"Updated {DEPLOY_INFO_PATH} with live Sepolia deployment.")

if __name__ == "__main__":
    deploy_to_sepolia()
