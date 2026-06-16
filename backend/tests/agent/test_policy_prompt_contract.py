from app.agent.prompts import SYSTEM_PROMPT
from app.agent.tools.definitions import TOOL_DEFINITIONS


def test_system_prompt_requires_policy_source_and_version():
    assert "source policy title" in SYSTEM_PROMPT
    assert "policy version" in SYSTEM_PROMPT


def test_get_policy_tool_definition_mentions_source_and_version():
    get_policy = next(tool for tool in TOOL_DEFINITIONS if tool["name"] == "get_policy")

    assert "source" in get_policy["description"].lower()
    assert "version" in get_policy["description"].lower()
