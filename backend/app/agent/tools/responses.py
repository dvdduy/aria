def tool_error(code: str, tool_name: str, message: str) -> dict:
    return {
        "error": code,
        "tool": tool_name,
        "message": message,
    }


def unknown_tool(tool_name: str) -> dict:
    return tool_error("unknown_tool", tool_name, f"Unknown tool: {tool_name}")


def tool_failed(tool_name: str) -> dict:
    return tool_error(
        "tool_failed",
        tool_name,
        "The tool failed while processing the request.",
    )


def not_implemented(tool_name: str) -> dict:
    return tool_error(
        "not_implemented",
        tool_name,
        "This agent tool is scaffolded but not implemented yet.",
    )


def profile_not_linked(tool_name: str) -> dict:
    return tool_error(
        "profile_not_linked",
        tool_name,
        "Your user account is not linked to an employee profile.",
    )


def not_authorized(tool_name: str, message: str) -> dict:
    return tool_error("not_authorized", tool_name, message)


def invalid_request(tool_name: str, message: str) -> dict:
    return tool_error("invalid_request", tool_name, message)


def not_found(tool_name: str, message: str) -> dict:
    return tool_error("not_found", tool_name, message)
