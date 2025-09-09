#!/usr/bin/env python3
"""
MCP Server for Supabase Data Inspection
Helps debug borrowings sync issues between Linux and Windows
"""

import asyncio
import json
import sys
from typing import Any, Dict, List
import httpx

class SupabaseInspector:
    def __init__(self):
        self.base_url = "https://ddlzenlqkofefdwdefzm.supabase.co/rest/v1"
        self.anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU"
        self.headers = {
            "apikey": self.anon_key,
            "Authorization": f"Bearer {self.anon_key}",
            "Content-Type": "application/json"
        }

    async def get_borrowings_sample(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get sample borrowings from Supabase"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/borrowings?limit={limit}",
                headers=self.headers
            )
            return response.json()

    async def get_group_borrowings_sample(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get sample group borrowings from Supabase"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/group_borrowings?limit={limit}",
                headers=self.headers
            )
            return response.json()

    async def get_borrowings_count(self) -> int:
        """Get total count of borrowings"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/borrowings?select=count",
                headers={**self.headers, "Prefer": "count=exact"}
            )
            return int(response.headers.get("content-range", "0").split("/")[-1])

    async def get_group_borrowings_count(self) -> int:
        """Get total count of group borrowings"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/group_borrowings?select=count",
                headers={**self.headers, "Prefer": "count=exact"}
            )
            return int(response.headers.get("content-range", "0").split("/")[-1])

    async def analyze_borrowings_structure(self) -> Dict[str, Any]:
        """Analyze borrowings data structure for sync issues"""
        borrowings = await self.get_borrowings_sample(50)
        group_borrowings = await self.get_group_borrowings_sample(50)
        
        analysis = {
            "borrowings": {
                "count": await self.get_borrowings_count(),
                "sample_size": len(borrowings),
                "fields": list(borrowings[0].keys()) if borrowings else [],
                "field_types": {},
                "null_fields": {},
                "date_formats": {}
            },
            "group_borrowings": {
                "count": await self.get_group_borrowings_count(),
                "sample_size": len(group_borrowings),
                "fields": list(group_borrowings[0].keys()) if group_borrowings else [],
                "field_types": {},
                "null_fields": {},
                "date_formats": {}
            }
        }
        
        # Analyze borrowings
        if borrowings:
            for field in analysis["borrowings"]["fields"]:
                values = [b.get(field) for b in borrowings]
                non_null_values = [v for v in values if v is not None]
                
                analysis["borrowings"]["null_fields"][field] = len(values) - len(non_null_values)
                
                if non_null_values:
                    sample_value = non_null_values[0]
                    analysis["borrowings"]["field_types"][field] = type(sample_value).__name__
                    
                    # Check date formats
                    if field in ["borrowed_date", "due_date", "returned_date", "created_at", "updated_at"]:
                        analysis["borrowings"]["date_formats"][field] = [
                            str(v) for v in non_null_values[:3] if v
                        ]
        
        # Analyze group borrowings
        if group_borrowings:
            for field in analysis["group_borrowings"]["fields"]:
                values = [b.get(field) for b in group_borrowings]
                non_null_values = [v for v in values if v is not None]
                
                analysis["group_borrowings"]["null_fields"][field] = len(values) - len(non_null_values)
                
                if non_null_values:
                    sample_value = non_null_values[0]
                    analysis["group_borrowings"]["field_types"][field] = type(sample_value).__name__
                    
                    # Check date formats
                    if field in ["borrowed_date", "due_date", "returned_date", "created_at", "updated_at"]:
                        analysis["group_borrowings"]["date_formats"][field] = [
                            str(v) for v in non_null_values[:3] if v
                        ]
        
        return analysis

    async def check_foreign_key_issues(self) -> Dict[str, Any]:
        """Check for foreign key constraint issues"""
        borrowings = await self.get_borrowings_sample(100)
        
        # Get student and book IDs for validation
        async with httpx.AsyncClient() as client:
            students_resp = await client.get(
                f"{self.base_url}/students?select=id",
                headers=self.headers
            )
            books_resp = await client.get(
                f"{self.base_url}/books?select=id",
                headers=self.headers
            )
            
        student_ids = {s["id"] for s in students_resp.json()}
        book_ids = {b["id"] for b in books_resp.json()}
        
        issues = {
            "missing_students": [],
            "missing_books": [],
            "invalid_dates": [],
            "empty_required_fields": []
        }
        
        for borrowing in borrowings:
            # Check foreign keys
            if borrowing.get("student_id") not in student_ids:
                issues["missing_students"].append({
                    "borrowing_id": borrowing.get("id"),
                    "student_id": borrowing.get("student_id")
                })
            
            if borrowing.get("book_id") not in book_ids:
                issues["missing_books"].append({
                    "borrowing_id": borrowing.get("id"),
                    "book_id": borrowing.get("book_id")
                })
            
            # Check required fields
            required_fields = ["id", "student_id", "book_id", "borrowed_date"]
            for field in required_fields:
                if not borrowing.get(field):
                    issues["empty_required_fields"].append({
                        "borrowing_id": borrowing.get("id"),
                        "missing_field": field
                    })
        
        return issues

async def main():
    inspector = SupabaseInspector()
    
    print("🔍 Analyzing Supabase borrowings data...")
    
    # Get structure analysis
    analysis = await inspector.analyze_borrowings_structure()
    print("\n📊 Data Structure Analysis:")
    print(json.dumps(analysis, indent=2))
    
    # Check for foreign key issues
    print("\n🔗 Checking Foreign Key Issues:")
    fk_issues = await inspector.check_foreign_key_issues()
    print(json.dumps(fk_issues, indent=2))
    
    # Get sample data
    print("\n📋 Sample Borrowings:")
    borrowings_sample = await inspector.get_borrowings_sample(3)
    print(json.dumps(borrowings_sample, indent=2))
    
    print("\n👥 Sample Group Borrowings:")
    group_borrowings_sample = await inspector.get_group_borrowings_sample(3)
    print(json.dumps(group_borrowings_sample, indent=2))

if __name__ == "__main__":
    asyncio.run(main())
