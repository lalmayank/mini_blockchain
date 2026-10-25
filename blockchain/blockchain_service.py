import os
import json
import solcx
from web3 import Web3
from web3.providers.eth_tester import EthereumTesterProvider

CONTRACT_SOURCE_PATH = os.path.join("blockchain", "contracts", "FraudAudit.sol")
DEPLOY_INFO_PATH = os.path.join("blockchain", "contract_deploy.json")

class BlockchainAuditService:
    """
    Python Blockchain Service for CrossBank TrustFL.
    Compiles and interacts with the Solidity FraudAudit smart contract via Web3.py.
    """
    def __init__(self, rpc_url: str = ""):
        # 1. Initialize Web3 Provider
        if rpc_url:
            self.w3 = Web3(Web3.HTTPProvider(rpc_url))
            print(f"[Blockchain] Connected to RPC: {rpc_url}")
        else:
            # Standalone EVM in-memory provider (no Node.js / Hardhat required)
            self.w3 = Web3(EthereumTesterProvider())
            print("[Blockchain] Connected to in-memory EVM TestNet provider.")

        self.account = self.w3.eth.accounts[0]
        self.w3.eth.default_account = self.account

        # 2. Compile and Deploy or Load Contract
        self.contract = self._get_or_deploy_contract()

    def _compile_contract(self):
        solcx.set_solc_version("0.8.20")
        compiled = solcx.compile_files(
            [CONTRACT_SOURCE_PATH],
            output_values=["abi", "bin"]
        )
        contract_key = "blockchain/contracts/FraudAudit.sol:FraudAudit"
        if contract_key not in compiled:
            # Fallback for Windows path formatting
            contract_key = [k for k in compiled.keys() if k.endswith(":FraudAudit")][0]
        return compiled[contract_key]["abi"], compiled[contract_key]["bin"]

    def _get_or_deploy_contract(self):
        abi, bytecode = self._compile_contract()

        # Check if already deployed
        if os.path.exists(DEPLOY_INFO_PATH):
            try:
                with open(DEPLOY_INFO_PATH, "r") as f:
                    info = json.load(f)
                    contract_address = info.get("address")
                    if contract_address:
                        # Verify code exists at address
                        code = self.w3.eth.get_code(contract_address)
                        if code and code != b"" and code != b"\x00":
                            print(f"[Blockchain] Loaded existing FraudAudit contract at: {contract_address}")
                            return self.w3.eth.contract(address=contract_address, abi=abi)
            except Exception:
                pass

        # Deploy fresh contract
        print("[Blockchain] Deploying FraudAudit.sol to EVM...")
        FraudAuditFactory = self.w3.eth.contract(abi=abi, bytecode=bytecode)
        tx_hash = FraudAuditFactory.constructor().transact({"from": self.account, "gas": 3000000})
        tx_receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
        contract_address = tx_receipt.contractAddress
        print(f"[Blockchain] FraudAudit contract successfully deployed at: {contract_address}")
        print(f"[Blockchain] Deployer Account: {self.account} | Gas Used: {tx_receipt.gasUsed}")

        # Save deploy info
        with open(DEPLOY_INFO_PATH, "w") as f:
            json.dump({
                "address": contract_address,
                "deployer": self.account,
                "abi": abi,
                "block_number": tx_receipt.blockNumber
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
        """
        bank_ids = [s["bank_id"] for s in submissions]
        weights_hashes = [s["weights_hash"] for s in submissions]
        sample_counts = [int(s["sample_count"]) for s in submissions]
        decisions = [s["decision"] for s in submissions]
        reasons = [s["reason"] for s in submissions]

        tx_hash = self.contract.functions.recordRound(
            round_id,
            defense_strategy,
            global_model_hash,
            bank_ids,
            weights_hashes,
            sample_counts,
            decisions,
            reasons
        ).transact({"from": self.account, "gas": 1000000})

        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
        return {
            "transaction_hash": tx_hash.hex(),
            "block_number": receipt.blockNumber,
            "gas_used": receipt.gasUsed,
            "round_id": round_id,
            "status": "SUCCESS" if receipt.status == 1 else "FAILED"
        }

    def get_round_audit(self, round_id: int) -> dict:
        """Reads audited round summary and submissions from the smart contract."""
        summary = self.contract.functions.getRoundSummary(round_id).call()
        total_subs = summary[5]
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

        return {
            "round_id": summary[0],
            "global_model_hash": summary[1],
            "defense_strategy": summary[2],
            "timestamp": summary[3],
            "is_finalized": summary[4],
            "total_submissions": total_subs,
            "submissions": submissions
        }

    def verify_model_hash(self, round_id: int, model_hash: str) -> bool:
        """Verifies if the specified model hash matches the on-chain commitment for that round."""
        return self.contract.functions.verifyGlobalModel(round_id, model_hash).call()

if __name__ == "__main__":
    # Test execution
    auditor = BlockchainAuditService()
    print("Testing recordRound on-chain transaction...")
    res = auditor.record_round_on_chain(
        round_id=1,
        defense_strategy="FEDAVG",
        global_model_hash="406aa1ddcf59d07528bf60fbabc579bf2948623fd673d5e7a05dbc869adccdc3",
        submissions=[
            {
                "bank_id": "bank_a",
                "weights_hash": "39d7813242391475da7c6555057b52a06532059fd09684b3514daf47f1b9e398",
                "sample_count": 284807,
                "decision": "ACCEPTED",
                "reason": "Update validated successfully."
            },
            {
                "bank_id": "bank_b",
                "weights_hash": "d8580923d62e5fb5d23881f830aed257622ae8239c0f1ace6b077f8df42658dd",
                "sample_count": 308213,
                "decision": "ACCEPTED",
                "reason": "Update validated successfully."
            },
            {
                "bank_id": "bank_c",
                "weights_hash": "4986cc18c3e6beb4f69bab6a788a3f49b94688a7fb0da7da59fe5b07e7b4ef06",
                "sample_count": 594643,
                "decision": "ACCEPTED",
                "reason": "Update validated successfully."
            }
        ]
    )
    print("On-Chain Transaction Result:", res)

    # Read back from contract
    audit_data = auditor.get_round_audit(1)
    print("\nAudited Data Read From Smart Contract:")
    print(json.dumps(audit_data, indent=2))

    # Verify model hash
    is_valid = auditor.verify_model_hash(1, "406aa1ddcf59d07528bf60fbabc579bf2948623fd673d5e7a05dbc869adccdc3")
    print(f"\nVerification Check of Global Model Hash: {is_valid} (Expected: True)")
    is_fake_valid = auditor.verify_model_hash(1, "0000000000000000000000000000000000000000")
    print(f"Verification Check of Fake Hash: {is_fake_valid} (Expected: False)")
