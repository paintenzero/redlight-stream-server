var intel = require("intel");

intel.config({
    "formatters": {
        "simple": {
            "format": "%(name)s [%(levelname)s]: %(message)s",
            "colorize": true
        }
    },
    "handlers": {
        "simple_terminal": {
            "class": intel.handlers.Console,
            "formatter": "simple",
            "level": "VERBOSE"
        }
    },
    "loggers": {
        "Redlight": {
            "handlers": ["simple_terminal"],
            "level": "DEBUG"
        },
        "Redlight.Crypto": {
        },
        "Redlight.HTTP": {
        }
    }
});
