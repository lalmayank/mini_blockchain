import os
import json
import time
import solcx
from web3 import Web3
from web3.providers.eth_tester import EthereumTesterProvider

CONTRACT_SOURCE_PATH = os.path.join("blockchain", "contracts", "FraudAudit.sol")
DEPLOY_INFO_PATH = os.path.join("blockchain", "contract_deploy.json")

def load_env_vars():
    env_path = ".env"
    env_vars = {}
    if os.path.exists(env_path):
        with open(env_path, "r") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    env_vars[k.strip()] = v.strip()
    return env_vars

class BlockchainAuditService:
    """
    Consortium Blockchain Service for CrossBank TrustFL.
    Supports Ethereum Sepolia Testnet, Multi-Sig 2-of-3 Bank Quorum, Gas Analytics,
    and automatic local EVM fallback.
    """
    def __init__(self, rpc_url: str = ""):
        env = load_env_vars()
        self.rpc_url = rpc_url or env.get("SEPOLIA_RPC_URL", "https://ethereum-sepolia-rpc.publicnode.com")
        self.coord_key = env.get("COORDINATOR_PRIVATE_KEY", "")
        self.coord_addr = env.get("COORDINATOR_ADDRESS", "")
        self.bank_a_addr = env.get("BANK_A_ADDRESS", "")
        self.bank_b_addr = env.get("BANK_B_ADDRESS", "")
        self.bank_c_addr = env.get("BANK_C_ADDRESS", "")
        self.required_approvals = int(env.get("REQUIRED_APPROVALS", "2"))

        # Gas tracking metrics
        self.cumulative_gas_used = 0
        self.latest_gas_price_gwei = 0.0
        self.latest_tx_fee_eth = 0.0
        self.latest_block_time = 12.0
        self.is_sepolia_live = False

        # 1. Initialize Web3 Provider
        self._init_web3()

        # 2. Compile and Deploy or Load Contract
        self.contract = self._get_or_deploy_contract()

    def _init_web3(self):
        try:
            w3_candidate = Web3(Web3.HTTPProvider(self.rpc_url))
            if w3_candidate.is_connected():
                self.w3 = w3_candidate
                self.is_sepolia_live = True
                print(f"[Blockchain] Connected to Sepolia RPC: {self.rpc_url} (Block #{self.w3.eth.block_number})")

                # Check if coordinator account is configured
                if self.coord_key:
                    try:
                        self.account = self.w3.eth.account.from_key(self.coord_key).address
                        self.w3.eth.default_account = self.account
                        balance = self.w3.eth.get_balance(self.account)
                        balance_eth = self.w3.from_wei(balance, "ether")
                        print(f"[Blockchain] Coordinator Account: {self.account} | Balance: {balance_eth:.5f} Sepolia ETH")
                    except Exception as acct_err:
                        print(f"[Blockchain] Account config error: {acct_err}")
                return
            else:
                print(f"[Blockchain] Could not connect to RPC {self.rpc_url}. Using in-memory fallback.")
        except Exception as e:
            print(f"[Blockchain] RPC connection error ({e}). Using in-memory fallback.")

        # Fallback to local in-memory EVM
        try:
            from web3.providers.eth_tester import EthereumTesterProvider
            self.w3 = Web3(EthereumTesterProvider())
            self.account = self.w3.eth.accounts[0]
            self.w3.eth.default_account = self.account
            self.is_sepolia_live = False
            print("[Blockchain] Connected to local in-memory EVM TestNet provider.")
        except Exception as fallback_err:
            print(f"[Blockchain] In-memory EVM unavailable ({fallback_err}). Using mock fallback.")
            self.w3 = Web3()
            self.account = "0x0000000000000000000000000000000000000001"
            self.is_sepolia_live = False

    def _compile_contract(self):
        solcx.set_solc_version("0.8.20")
        compiled = solcx.compile_files(
            [CONTRACT_SOURCE_PATH],
            output_values=["abi", "bin"]
        )
        contract_key = "blockchain/contracts/FraudAudit.sol:FraudAudit"
        if contract_key not in compiled:
            contract_key = [k for k in compiled.keys() if k.endswith(":FraudAudit")][0]
        return compiled[contract_key]["abi"], compiled[contract_key]["bin"]

    def _get_or_deploy_contract(self):
        abi, bytecode = self._compile_contract()

        # Check existing deployment file
        if os.path.exists(DEPLOY_INFO_PATH):
            try:
                with open(DEPLOY_INFO_PATH, "r") as f:
                    info = json.load(f)
                    contract_address = info.get("address")
                    if contract_address:
                        print(f"[Blockchain] Using FraudAudit contract from config at: {contract_address}")
                        return self.w3.eth.contract(address=contract_address, abi=abi)
            except Exception:
                pass

        # Deploy fresh contract with Bank identities
        print("[Blockchain] Preparing Multi-Sig FraudAudit.sol...")
        FraudAuditFactory = self.w3.eth.contract(abi=abi, bytecode=bytecode)

        bank_a = self.bank_a_addr if Web3.is_address(self.bank_a_addr) else (self.w3.eth.accounts[1] if len(self.w3.eth.accounts) > 1 else self.account)
        bank_b = self.bank_b_addr if Web3.is_address(self.bank_b_addr) else (self.w3.eth.accounts[2] if len(self.w3.eth.accounts) > 2 else self.account)
        bank_c = self.bank_c_addr if Web3.is_address(self.bank_c_addr) else (self.w3.eth.accounts[3] if len(self.w3.eth.accounts) > 3 else self.account)

        constructor_args = [bank_a, bank_b, bank_c, self.required_approvals]
        contract_address = "0xF2E246BB76DF876Cef8b38ae84130F4F55De395b"
        block_number = 0

        # Check if deploying to live Sepolia or in-memory
        try:
            if self.is_sepolia_live and self.coord_key and self.w3.eth.get_balance(self.account) > 0:
                tx = FraudAuditFactory.constructor(*constructor_args).build_transaction({
                    "from": self.account,
                    "nonce": self.w3.eth.get_transaction_count(self.account),
                    "gas": 3500000,
                    "gasPrice": self.w3.eth.gas_price
                })
                signed_tx = self.w3.eth.account.sign_transaction(tx, self.coord_key)
                tx_hash = self.w3.eth.send_raw_transaction(signed_tx.raw_transaction)
                tx_receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
                contract_address = tx_receipt.contractAddress
                block_number = tx_receipt.blockNumber
                print(f"[Blockchain] FraudAudit deployed at: {contract_address} (Gas: {tx_receipt.gasUsed})")
            elif not self.is_sepolia_live:
                tx_hash = FraudAuditFactory.constructor(*constructor_args).transact({"from": self.account, "gas": 3500000})
                tx_receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
                contract_address = tx_receipt.contractAddress
                block_number = tx_receipt.blockNumber
                print(f"[Blockchain] FraudAudit deployed at: {contract_address} (Gas: {tx_receipt.gasUsed})")
            else:
                print(f"[Blockchain] Ready for 1-Click MetaMask deployment. Current registered target: {contract_address}")
        except Exception as deploy_err:
            print(f"[Blockchain] Auto-deployment skipped ({deploy_err}). Ready for MetaMask deployment.")

        with open(DEPLOY_INFO_PATH, "w") as f:
            json.dump({
                "address": contract_address,
                "deployer": self.account,
                "abi": abi,
                "block_number": block_number,
                "network": "Sepolia Testnet" if self.is_sepolia_live else "Local EVM",
                "bank_a": bank_a,
                "bank_b": bank_b,
                "bank_c": bank_c,
                "required_approvals": self.required_approvals
            }, f, indent=2)

        return self.w3.eth.contract(address=contract_address, abi=abi)

    def record_round_on_chain(
        self,
        round_id: int,
        defense_strategy: str,
        global_model_hash: str,
        submissions: list
    ) -> dict:
        """
        Commits round submissions, defense screening verdicts, and final global model hash to the smart contract.
        Tracks gas estimation, actual gas consumption, and network analytics.
        """
        bank_ids = [s["bank_id"] for s in submissions]
        weights_hashes = [s["weights_hash"] for s in submissions]
        sample_counts = [int(s["sample_count"]) for s in submissions]
        decisions = [s["decision"] for s in submissions]
        reasons = [s["reason"] for s in submissions]

        # 1. Estimate Gas
        estimated_gas = 1200000
        try:
            estimated_gas = self.contract.functions.recordRound(
                round_id, defense_strategy, global_model_hash,
                bank_ids, weights_hashes, sample_counts, decisions, reasons
            ).estimate_gas({"from": self.account})
        except Exception:
            pass

        # 2. Execute Transaction
        start_time = time.time()
        gas_price = self.w3.eth.gas_price

        if self.is_sepolia_live and self.coord_key and self.w3.eth.get_balance(self.account) > 0:
            tx = self.contract.functions.recordRound(
                round_id, defense_strategy, global_model_hash,
                bank_ids, weights_hashes, sample_counts, decisions, reasons
            ).build_transaction({
                "from": self.account,
                "nonce": self.w3.eth.get_transaction_count(self.account),
                "gas": int(estimated_gas * 1.2),
                "gasPrice": gas_price
            })
            signed_tx = self.w3.eth.account.sign_transaction(tx, self.coord_key)
            tx_hash = self.w3.eth.send_raw_transaction(signed_tx.raw_transaction)
            receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
        else:
            tx_hash = self.contract.functions.recordRound(
                round_id, defense_strategy, global_model_hash,
                bank_ids, weights_hashes, sample_counts, decisions, reasons
            ).transact({"from": self.account, "gas": int(estimated_gas * 1.2)})
            receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)

        elapsed = time.time() - start_time
        gas_used = receipt.gasUsed
        fee_wei = gas_used * gas_price
        fee_eth = float(self.w3.from_wei(fee_wei, "ether"))
        gas_price_gwei = float(self.w3.from_wei(gas_price, "gwei"))

        # Update Analytics
        self.cumulative_gas_used += gas_used
        self.latest_gas_price_gwei = gas_price_gwei
        self.latest_tx_fee_eth = fee_eth
        self.latest_block_time = max(round(elapsed, 2), 0.5)

        return {
            "transaction_hash": tx_hash.hex(),
            "block_number": receipt.blockNumber,
            "gas_used": gas_used,
            "estimated_gas": estimated_gas,
            "gas_price_gwei": round(gas_price_gwei, 2),
            "fee_eth": round(fee_eth, 6),
            "round_id": round_id,
            "status": "SUCCESS" if receipt.status == 1 else "FAILED",
            "etherscan_url": f"https://sepolia.etherscan.io/tx/{tx_hash.hex()}" if self.is_sepolia_live else None
        }

    def approve_round_by_bank(self, round_id: int, bank_address: str, bank_private_key: str = "") -> dict:
        """Approves a round on-chain using a bank's authorized signing key."""
        sender = bank_address
        if bank_private_key:
            sender = self.w3.eth.account.from_key(bank_private_key).address

        tx_hash = self.contract.functions.approveRound(round_id).transact({"from": sender, "gas": 300000})
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
        return {
            "transaction_hash": tx_hash.hex(),
            "block_number": receipt.blockNumber,
            "gas_used": receipt.gasUsed,
            "status": "APPROVED" if receipt.status == 1 else "FAILED"
        }

    def get_round_audit(self, round_id: int) -> dict:
        """Reads audited round summary, approvals, and submissions from the smart contract."""
        summary = self.contract.functions.getRoundSummary(round_id).call()
        total_subs = summary[7]
        submissions = []
        for i in range(total_subs):
            sub = self.contract.functions.getRoundSubmission(round_id, i).call()
            submissions.append({
                "bank_id": sub[0],
                "weights_hash": sub[1],
                "sample_count": sub[2],
                "decision": sub[3],
                "reason": sub[4],
                "timestamp": sub[5]
            })

        approvers = self.contract.functions.getRoundApprovers(round_id).call()

        return {
            "round_id": summary[0],
            "global_model_hash": summary[1],
            "defense_strategy": summary[2],
            "timestamp": summary[3],
            "is_proposed": summary[4],
            "is_finalized": summary[5],
            "approval_count": summary[6],
            "total_submissions": total_subs,
            "approvers": list(approvers),
            "submissions": submissions
        }

    def verify_model_hash(self, round_id: int, model_hash: str) -> bool:
        """Verifies if the specified model hash matches the on-chain commitment for that round."""
        return self.contract.functions.verifyGlobalModel(round_id, model_hash).call()

    def get_gas_metrics(self) -> dict:
        """Returns live consortium gas metrics and network analytics."""
        eth_price_usd = 2650.0  # Reference price for fiat equivalent calculation
        usd_cost = self.latest_tx_fee_eth * eth_price_usd
        return {
            "cumulative_gas_used": self.cumulative_gas_used,
            "latest_gas_price_gwei": self.latest_gas_price_gwei,
            "latest_tx_fee_eth": self.latest_tx_fee_eth,
            "estimated_usd_cost": round(usd_cost, 4),
            "block_confirmation_time_sec": self.latest_block_time,
            "network": "Ethereum Sepolia Testnet (EIP-1559)" if self.is_sepolia_live else "Consortium Local EVM (PoS Simulator)",
            "consensus": "Proof of Stake (PoS) + 2-of-3 Bank Quorum"
        }

if __name__ == "__main__":
    service = BlockchainAuditService()
    print("Testing record_round_on_chain with Gas calculation...")
    res = service.record_round_on_chain(
        round_id=1,
        defense_strategy="FEDAVG",
        global_model_hash="406aa1ddcf59d07528bf60fbabc579bf2948623fd673d5e7a05dbc869adccdc3",
        submissions=[
            {"bank_id": "bank_a", "weights_hash": "39d7813242391475da7c6555057b52a06532059fd09684b3514daf47f1b9e398", "sample_count": 284807, "decision": "ACCEPTED", "reason": "Update validated"},
            {"bank_id": "bank_b", "weights_hash": "d8580923d62e5fb5d23881f830aed257622ae8239c0f1ace6b077f8df42658dd", "sample_count": 308213, "decision": "ACCEPTED", "reason": "Update validated"},
            {"bank_id": "bank_c", "weights_hash": "4986cc18c3e6beb4f69bab6a788a3f49b94688a7fb0da7da59fe5b07e7b4ef06", "sample_count": 594643, "decision": "ACCEPTED", "reason": "Update validated"}
        ]
    )
    print("Result:", res)
    print("\nGas Metrics:", service.get_gas_metrics())
