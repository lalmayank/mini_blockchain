import os
import json
from typing import Dict, List, Any
from blockchain.blockchain_service import BlockchainAuditService, DEPLOY_INFO_PATH

class ChainService:
    """Wrapper around BlockchainAuditService for FastAPI controllers."""
    def __init__(self):
        self._auditor = None

    def get_auditor(self) -> BlockchainAuditService:
        if self._auditor is None:
            self._auditor = BlockchainAuditService()
        return self._auditor

    def record_round(
        self,
        round_id: int,
        defense_strategy: str,
        global_model_hash: str,
        submissions: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        auditor = self.get_auditor()
        res = auditor.record_round_on_chain(
            round_id=round_id,
            defense_strategy=defense_strategy,
            global_model_hash=global_model_hash,
            submissions=submissions
        )

        # Update local audit ledger file with new receipt details (including gas & tx)
        ledger_path = os.path.join("checkpoints", "audit_ledger.json")
        os.makedirs("checkpoints", exist_ok=True)
        records = self.get_audit_ledger_records()

        # Check if record already exists
        updated = False
        new_record = {
            "round_id": round_id,
            "defense_strategy": defense_strategy,
            "resulting_global_model_hash": global_model_hash,
            "client_submissions": submissions,
            "blockchain_receipt": res
        }
        for idx, rec in enumerate(records):
            if rec.get("round_id") == round_id:
                records[idx] = new_record
                updated = True
                break
        if not updated:
            records.append(new_record)

        try:
            with open(ledger_path, "w") as f:
                json.dump(records, f, indent=2)
        except Exception:
            pass

        return res

    def get_round_audit(self, round_id: int) -> Dict[str, Any]:
        auditor = self.get_auditor()
        return auditor.get_round_audit(round_id)

    def verify_hash(self, round_id: int, model_hash: str) -> bool:
        auditor = self.get_auditor()
        return auditor.verify_model_hash(round_id, model_hash)

    def approve_round(self, round_id: int, bank_address: str, bank_private_key: str = "") -> Dict[str, Any]:
        auditor = self.get_auditor()
        return auditor.approve_round_by_bank(round_id, bank_address, bank_private_key)

    def get_gas_metrics(self) -> Dict[str, Any]:
        auditor = self.get_auditor()
        return auditor.get_gas_metrics()

    def get_chain_config(self) -> Dict[str, Any]:
        auditor = self.get_auditor()
        contract_addr = ""
        abi = []
        is_sepolia_deployed = False
        etherscan_url = None
        if os.path.exists(DEPLOY_INFO_PATH):
            try:
                with open(DEPLOY_INFO_PATH, "r") as f:
                    deploy_data = json.load(f)
                    contract_addr = deploy_data.get("address", "")
                    abi = deploy_data.get("abi", [])
                    if deploy_data.get("network") == "Ethereum Sepolia Testnet" or "sepolia" in deploy_data.get("etherscan_url", ""):
                        is_sepolia_deployed = True
                        etherscan_url = f"https://sepolia.etherscan.io/address/{contract_addr}"
            except Exception:
                pass

        return {
            "contract_address": contract_addr,
            "abi": abi,
            "rpc_url": auditor.rpc_url,
            "is_sepolia": auditor.is_sepolia_live,
            "is_sepolia_deployed": is_sepolia_deployed,
            "etherscan_url": etherscan_url,
            "network": "Ethereum Sepolia Testnet" if auditor.is_sepolia_live else "Local Consortium EVM",
            "chain_id": 11155111 if auditor.is_sepolia_live else 1337,
            "chain_id_hex": "0xaa36a7" if auditor.is_sepolia_live else "0x539",
            "coordinator_address": auditor.coord_addr or auditor.account,
            "bank_a_address": auditor.bank_a_addr,
            "bank_b_address": auditor.bank_b_addr,
            "bank_c_address": auditor.bank_c_addr,
            "required_approvals": auditor.required_approvals
        }

    def get_deploy_payload(self) -> Dict[str, Any]:
        auditor = self.get_auditor()
        abi, bytecode = auditor._compile_contract()
        clean_bytecode = bytecode if bytecode.startswith("0x") else f"0x{bytecode}"
        return {
            "abi": abi,
            "bytecode": clean_bytecode,
            "bank_a": auditor.bank_a_addr,
            "bank_b": auditor.bank_b_addr,
            "bank_c": auditor.bank_c_addr,
            "required_approvals": auditor.required_approvals
        }

    def sync_user_wallet(self, address: str, role: str = "coordinator") -> Dict[str, Any]:
        auditor = self.get_auditor()
        role = role.lower()
        if role == "coordinator":
            auditor.coord_addr = address
        elif role in ["bank_a", "bank a"]:
            auditor.bank_a_addr = address
        elif role in ["bank_b", "bank b"]:
            auditor.bank_b_addr = address
        elif role in ["bank_c", "bank c"]:
            auditor.bank_c_addr = address

        # Persist to .env
        env_path = ".env"
        if os.path.exists(env_path):
            try:
                with open(env_path, "r") as f:
                    lines = f.readlines()
                key_name = f"{role.replace(' ', '_').upper()}_ADDRESS"
                found = False
                new_lines = []
                for line in lines:
                    if line.startswith(f"{key_name}="):
                        new_lines.append(f"{key_name}={address}\n")
                        found = True
                    else:
                        new_lines.append(line)
                if not found:
                    new_lines.append(f"{key_name}={address}\n")
                with open(env_path, "w") as f:
                    f.writelines(new_lines)
            except Exception:
                pass

        return {"status": "SYNCED", "address": address, "role": role}

    def register_deployed_contract(self, contract_address: str, deployer: str, tx_hash: str = "", block_number: int = 0) -> Dict[str, Any]:
        auditor = self.get_auditor()
        abi, _ = auditor._compile_contract()
        deploy_data = {
            "address": contract_address,
            "deployer": deployer,
            "abi": abi,
            "block_number": block_number,
            "network": "Ethereum Sepolia Testnet",
            "chain_id": 11155111,
            "tx_hash": tx_hash,
            "etherscan_url": f"https://sepolia.etherscan.io/address/{contract_address}"
        }
        with open(DEPLOY_INFO_PATH, "w") as f:
            json.dump(deploy_data, f, indent=2)

        try:
            auditor.contract = auditor.w3.eth.contract(address=contract_address, abi=abi)
        except Exception:
            pass

        return {
            "status": "REGISTERED",
            "contract_address": contract_address,
            "etherscan_url": deploy_data["etherscan_url"]
        }

    def get_audit_ledger_records(self) -> List[Dict[str, Any]]:
        ledger_path = os.path.join("checkpoints", "audit_ledger.json")
        if os.path.exists(ledger_path):
            try:
                with open(ledger_path, "r") as f:
                    return json.load(f)
            except Exception:
                return []
        return []

chain_service = ChainService()
