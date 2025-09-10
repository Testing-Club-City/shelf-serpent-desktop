#!/usr/bin/env python3
import json
import sys
import asyncio
import httpx
from mcp.server import Server
from mcp.types import Tool, TextContent

# Supabase credentials
SUPABASE_URL = "https://ddlzenlqkofefdwdefzm.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbHplbmxxa29mZWZkd2RlZnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MzEwNDUsImV4cCI6MjA2NDUwNzA0NX0.wyIuCalCMVs5zUPExw02QDYDrQSCCEzZerYBA_hfosU"

server = Server("supabase-schema-checker")

@server.list_tools()
async def list_tools():
    return [
        Tool(
            name="check_table_schema",
            description="Check schema for a specific Supabase table",
            inputSchema={
                "type": "object",
                "properties": {
                    "table_name": {"type": "string", "description": "Name of the table to check"}
                },
                "required": ["table_name"]
            }
        ),
        Tool(
            name="list_all_tables",
            description="List all tables in Supabase database",
            inputSchema={"type": "object", "properties": {}}
        ),
        Tool(
            name="check_borrowings_schema",
            description="Check borrowings table schema specifically",
            inputSchema={"type": "object", "properties": {}}
        )
    ]

@server.call_tool()
async def call_tool(name: str, arguments: dict):
    if name == "check_table_schema":
        table_name = arguments["table_name"]
        async with httpx.AsyncClient() as client:
            # Get table schema from Supabase REST API
            response = await client.get(
                f"{SUPABASE_URL}/rest/v1/{table_name}",
                headers={
                    "apikey": SUPABASE_ANON_KEY,
                    "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
                    "Prefer": "return=minimal"
                },
                params={"limit": 0}
            )
            
            if response.status_code == 200:
                # Get one record to see structure
                sample_response = await client.get(
                    f"{SUPABASE_URL}/rest/v1/{table_name}",
                    headers={
                        "apikey": SUPABASE_ANON_KEY,
                        "Authorization": f"Bearer {SUPABASE_ANON_KEY}"
                    },
                    params={"limit": 1}
                )
                
                if sample_response.status_code == 200:
                    data = sample_response.json()
                    if data:
                        columns = list(data[0].keys())
                        return [TextContent(
                            type="text",
                            text=f"Table '{table_name}' columns:\n" + "\n".join(f"- {col}" for col in columns)
                        )]
                    else:
                        return [TextContent(type="text", text=f"Table '{table_name}' exists but is empty")]
                else:
                    return [TextContent(type="text", text=f"Error accessing table: {sample_response.status_code}")]
            else:
                return [TextContent(type="text", text=f"Table '{table_name}' not found or access denied: {response.status_code}")]
    
    elif name == "list_all_tables":
        # Try common table names
        tables = ["borrowings", "students", "books", "staff", "classes", "categories", "book_copies", "fines", "fine_settings", "group_borrowings"]
        results = []
        
        async with httpx.AsyncClient() as client:
            for table in tables:
                try:
                    response = await client.get(
                        f"{SUPABASE_URL}/rest/v1/{table}",
                        headers={
                            "apikey": SUPABASE_ANON_KEY,
                            "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
                            "Prefer": "return=minimal"
                        },
                        params={"limit": 0}
                    )
                    if response.status_code == 200:
                        results.append(f"✅ {table}")
                    else:
                        results.append(f"❌ {table} ({response.status_code})")
                except:
                    results.append(f"❌ {table} (error)")
        
        return [TextContent(type="text", text="Supabase Tables:\n" + "\n".join(results))]
    
    elif name == "check_borrowings_schema":
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{SUPABASE_URL}/rest/v1/borrowings",
                headers={
                    "apikey": SUPABASE_ANON_KEY,
                    "Authorization": f"Bearer {SUPABASE_ANON_KEY}"
                },
                params={"limit": 1}
            )
            
            if response.status_code == 200:
                data = response.json()
                if data:
                    columns = list(data[0].keys())
                    sample_record = data[0]
                    
                    result = f"Borrowings table schema:\n\nColumns ({len(columns)}):\n"
                    for col in sorted(columns):
                        value = sample_record.get(col)
                        value_type = type(value).__name__
                        result += f"- {col}: {value_type}\n"
                    
                    result += f"\nSample record:\n{json.dumps(sample_record, indent=2)}"
                    return [TextContent(type="text", text=result)]
                else:
                    return [TextContent(type="text", text="Borrowings table is empty")]
            else:
                return [TextContent(type="text", text=f"Error accessing borrowings: {response.status_code}")]

async def main():
    from mcp.server.stdio import stdio_server
    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, server.create_initialization_options())

if __name__ == "__main__":
    asyncio.run(main())