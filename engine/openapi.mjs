export const spec = {
  "openapi": "3.1.0",
  "info": {
    "title": "TaxPulse Global — sample API",
    "version": "0.1.0",
    "description": "Unverified prototype calculations; fictional inputs only. Not suitable for filing, payroll or financial decisions."
  },
  "paths": {
    "/v1/catalog": {
      "get": {
        "operationId": "getSampleCatalog",
        "responses": {
          "200": {
            "description": "Sample country and module catalog"
          }
        }
      }
    },
    "/v1/country/calculate": {
      "post": {
        "operationId": "calculateCountrySample",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": [
                  "country",
                  "taxYear",
                  "module",
                  "parameters"
                ],
                "properties": {
                  "country": {
                    "enum": [
                      "IN",
                      "US",
                      "GB",
                      "DE",
                      "AE",
                      "CA",
                      "AU",
                      "SG"
                    ]
                  },
                  "taxYear": {
                    "const": "2026"
                  },
                  "module": {
                    "enum": [
                      "pit"
                    ]
                  },
                  "parameters": {
                    "type": "object",
                    "description": "For IN, US and GB PIT, parameters use grossSalary and optional preTaxDeductions; US filingStatus is one of single (default), mfj, hoh or mfs, and IN requires residentIndividual. For DE, parameters require taxableIncome and assessment (individual or joint). For AE, parameters require salaryIncome and employeeWagesOnly=true. For CA, parameters require taxableIncome, netIncome and fullYearResident=true. For AU and SG, parameters require taxableIncome and residentEligible=true. The five extended country cases are scoped components, not gross-to-net salary estimates. All results are sampleOnly=true and taxRulesVerified=false."
                  }
                },
                "additionalProperties": false
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Unverified sample result"
          },
          "400": {
            "description": "Invalid input"
          }
        }
      }
    },
    "/v1/advanced/calculate": {
      "post": {
        "operationId": "calculateAdvancedScenario",
        "description": "Fictional scenario arithmetic only; no live rates or legal tax determination.",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": [
                  "module",
                  "parameters"
                ],
                "properties": {
                  "module": {
                    "enum": [
                      "salary_hike",
                      "fire_wealth",
                      "fx_payout",
                      "team_planner",
                      "transfer_pricing",
                      "quarterly_tax",
                      "equity_bonus",
                      "contractor_eor",
                      "gratuity_exit",
                      "freelancer_billing",
                      "freelancer_ledger",
                      "residency_payslip",
                      "ctc_restructurer",
                      "bulk_csv",
                      "tax_vault",
                      "payroll_hra_generator",
                      "ca_handoff",
                      "pe_risk",
                      "expat_nomad",
                      "agent_deal_desk"
                    ]
                  },
                  "parameters": {
                    "type": "object"
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Scenario calculation"
          },
          "400": {
            "description": "Invalid parameters"
          }
        }
      }
    },
    "/v1/capabilities": {
      "get": {
        "operationId": "getCapabilities",
        "responses": {
          "200": {
            "description": "Actual preview capabilities and disabled services"
          }
        }
      }
    },
    "/v1/regulatory/status": {
      "get": {
        "operationId": "getRegulatoryStatus",
        "responses": {
          "200": {
            "description": "Static regulatory verification manifest; not a live monitoring report"
          }
        }
      }
    },
    "/v1/discovery": {
      "get": {
        "operationId": "getDiscovery",
        "responses": {
          "200": {
            "description": "REST discovery metadata"
          }
        }
      }
    },
    "/v1/taxable-income/calculate": {
      "post": {
        "operationId": "calculateTaxableIncomeSample",
        "description": "Fictional scoped income tax examples for DE, CA, AU, SG and AE. AE accepts employee wages only; other examples require taxable income. Not take-home pay.",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "oneOf": [
                  {
                    "type": "object",
                    "required": [
                      "country",
                      "taxYear",
                      "taxableIncome",
                      "assessment"
                    ],
                    "additionalProperties": false,
                    "properties": {
                      "country": {
                        "const": "DE"
                      },
                      "taxYear": {
                        "const": "2026"
                      },
                      "taxableIncome": {
                        "type": "number",
                        "minimum": 0,
                        "maximum": 1000000000
                      },
                      "assessment": {
                        "enum": [
                          "individual",
                          "joint"
                        ]
                      }
                    }
                  },
                  {
                    "type": "object",
                    "required": [
                      "country",
                      "taxYear",
                      "taxableIncome",
                      "netIncome",
                      "fullYearResident"
                    ],
                    "additionalProperties": false,
                    "properties": {
                      "country": {
                        "const": "CA"
                      },
                      "taxYear": {
                        "const": "2026"
                      },
                      "taxableIncome": {
                        "type": "number",
                        "minimum": 0,
                        "maximum": 1000000000
                      },
                      "netIncome": {
                        "type": "number",
                        "minimum": 0,
                        "maximum": 1000000000
                      },
                      "fullYearResident": {
                        "const": true
                      }
                    }
                  },
                  {
                    "type": "object",
                    "additionalProperties": false,
                    "required": [
                      "country",
                      "taxYear",
                      "taxableIncome",
                      "residentEligible"
                    ],
                    "properties": {
                      "country": {
                        "const": "AU"
                      },
                      "taxYear": {
                        "const": "2026"
                      },
                      "taxableIncome": {
                        "type": "number",
                        "minimum": 0,
                        "maximum": 1000000000
                      },
                      "residentEligible": {
                        "const": true
                      }
                    }
                  },
                  {
                    "type": "object",
                    "additionalProperties": false,
                    "required": [
                      "country",
                      "taxYear",
                      "taxableIncome",
                      "residentEligible"
                    ],
                    "properties": {
                      "country": {
                        "const": "SG"
                      },
                      "taxYear": {
                        "const": "2026"
                      },
                      "taxableIncome": {
                        "type": "number",
                        "minimum": 0,
                        "maximum": 1000000000
                      },
                      "residentEligible": {
                        "const": true
                      }
                    }
                  },
                  {
                    "type": "object",
                    "additionalProperties": false,
                    "required": [
                      "country",
                      "taxYear",
                      "salaryIncome",
                      "employeeWagesOnly"
                    ],
                    "properties": {
                      "country": {
                        "const": "AE"
                      },
                      "taxYear": {
                        "const": "2026"
                      },
                      "salaryIncome": {
                        "type": "number",
                        "minimum": 0,
                        "maximum": 1000000000
                      },
                      "employeeWagesOnly": {
                        "const": true
                      }
                    }
                  }
                ]
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Unverified scoped calculation"
          },
          "400": {
            "description": "Invalid or unsupported input"
          }
        }
      }
    },
    "/v1/india/regime-compare": {
      "post": {
        "operationId": "compareIndiaRegimes",
        "description": "Unverified ordinary salary examples only for FY 2026–27. Other deductions are caller-confirmed eligible amounts excluding the standard deduction.",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "country",
                  "taxYear",
                  "grossSalary",
                  "residentIndividual",
                  "ageGroup",
                  "ordinarySalaryOnly",
                  "oldEligibleDeductions",
                  "newEligibleDeductions"
                ],
                "properties": {
                  "country": {
                    "const": "IN"
                  },
                  "taxYear": {
                    "const": "2026"
                  },
                  "grossSalary": {
                    "type": "integer",
                    "minimum": 0,
                    "maximum": 1000000000
                  },
                  "residentIndividual": {
                    "type": "boolean"
                  },
                  "ageGroup": {
                    "enum": [
                      "under-60",
                      "60-79",
                      "80-plus"
                    ]
                  },
                  "ordinarySalaryOnly": {
                    "const": true
                  },
                  "oldEligibleDeductions": {
                    "type": "integer",
                    "minimum": 0,
                    "maximum": 1000000000
                  },
                  "newEligibleDeductions": {
                    "type": "integer",
                    "minimum": 0,
                    "maximum": 1000000000
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Unsigned unverified comparison"
          },
          "400": {
            "description": "Unsupported input"
          }
        }
      }
    },
    "/v1/investment/capital-gain": {
      "post": {
        "operationId": "calculateCapitalGainExample",
        "description": "Scoped shares, property and cryptocurrency sale examples; assets and eligibility vary by country. India crypto requires gross proceeds, acquisition cost only and zero eligibleLosses. See returned limitations.",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "oneOf": [
                  {
                    "type": "object",
                    "additionalProperties": false,
                    "required": [
                      "taxYear",
                      "acquired",
                      "disposed",
                      "saleProceeds",
                      "adjustedBasis",
                      "eligibleLosses",
                      "otherTaxableIncome",
                      "scopeConfirmed",
                      "country",
                      "assetType"
                    ],
                    "properties": {
                      "taxYear": {
                        "const": "2026"
                      },
                      "acquired": {
                        "type": "string",
                        "format": "date"
                      },
                      "disposed": {
                        "type": "string",
                        "format": "date"
                      },
                      "saleProceeds": {
                        "type": "number",
                        "minimum": 0,
                        "maximum": 1000000000,
                        "multipleOf": 0.01
                      },
                      "adjustedBasis": {
                        "type": "number",
                        "minimum": 0,
                        "maximum": 1000000000,
                        "multipleOf": 0.01
                      },
                      "eligibleLosses": {
                        "type": "number",
                        "minimum": 0,
                        "maximum": 1000000000,
                        "multipleOf": 0.01
                      },
                      "otherTaxableIncome": {
                        "type": "number",
                        "minimum": 0,
                        "maximum": 1000000000,
                        "multipleOf": 0.01
                      },
                      "scopeConfirmed": {
                        "const": true
                      },
                      "country": {
                        "const": "IN"
                      },
                      "assetType": {
                        "enum": [
                          "listed-equity",
                          "equity-fund",
                          "property",
                          "crypto"
                        ]
                      }
                    }
                  },
                  {
                    "type": "object",
                    "additionalProperties": false,
                    "required": [
                      "taxYear",
                      "acquired",
                      "disposed",
                      "saleProceeds",
                      "adjustedBasis",
                      "eligibleLosses",
                      "otherTaxableIncome",
                      "scopeConfirmed",
                      "country",
                      "filingStatus"
                    ],
                    "properties": {
                      "taxYear": {
                        "const": "2026"
                      },
                      "acquired": {
                        "type": "string",
                        "format": "date"
                      },
                      "disposed": {
                        "type": "string",
                        "format": "date"
                      },
                      "saleProceeds": {
                        "type": "number",
                        "minimum": 0,
                        "maximum": 1000000000,
                        "multipleOf": 0.01
                      },
                      "adjustedBasis": {
                        "type": "number",
                        "minimum": 0,
                        "maximum": 1000000000,
                        "multipleOf": 0.01
                      },
                      "eligibleLosses": {
                        "type": "number",
                        "minimum": 0,
                        "maximum": 1000000000,
                        "multipleOf": 0.01
                      },
                      "otherTaxableIncome": {
                        "type": "number",
                        "minimum": 0,
                        "maximum": 1000000000,
                        "multipleOf": 0.01
                      },
                      "scopeConfirmed": {
                        "const": true
                      },
                      "country": {
                        "const": "US"
                      },
                      "filingStatus": {
                        "enum": [
                          "single",
                          "mfj",
                          "mfs",
                          "hoh"
                        ]
                      },
                      "assetType": {
                        "enum": [
                          "listed-equity",
                          "investment-land",
                          "crypto"
                        ]
                      }
                    }
                  },
                  {
                    "type": "object",
                    "additionalProperties": false,
                    "required": [
                      "taxYear",
                      "acquired",
                      "disposed",
                      "saleProceeds",
                      "adjustedBasis",
                      "eligibleLosses",
                      "otherTaxableIncome",
                      "scopeConfirmed",
                      "country"
                    ],
                    "properties": {
                      "taxYear": {
                        "const": "2026"
                      },
                      "acquired": {
                        "type": "string",
                        "format": "date"
                      },
                      "disposed": {
                        "type": "string",
                        "format": "date"
                      },
                      "saleProceeds": {
                        "type": "number",
                        "minimum": 0,
                        "maximum": 1000000000,
                        "multipleOf": 0.01
                      },
                      "adjustedBasis": {
                        "type": "number",
                        "minimum": 0,
                        "maximum": 1000000000,
                        "multipleOf": 0.01
                      },
                      "eligibleLosses": {
                        "type": "number",
                        "minimum": 0,
                        "maximum": 1000000000,
                        "multipleOf": 0.01
                      },
                      "otherTaxableIncome": {
                        "type": "number",
                        "minimum": 0,
                        "maximum": 1000000000,
                        "multipleOf": 0.01
                      },
                      "scopeConfirmed": {
                        "const": true
                      },
                      "country": {
                        "const": "GB"
                      },
                      "assetType": {
                        "enum": [
                          "listed-equity",
                          "property",
                          "crypto"
                        ]
                      }
                    }
                  }
                ]
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Scoped example gain tax"
          },
          "400": {
            "description": "Unsupported input"
          }
        }
      }
    },
    "/v1/regional/calculate": {
      "post": {
        "operationId": "calculateRegionalTax",
        "description": "Unverified component only. US state taxable income (Texas wages); Canada basic provincial/territorial tax before credits and adjustments; UK ordinary salary only. Not take-home pay.",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "oneOf": [
                  {
                    "type": "object",
                    "additionalProperties": false,
                    "required": [
                      "country",
                      "region",
                      "taxYear",
                      "income",
                      "scopeConfirmed"
                    ],
                    "properties": {
                      "country": {
                        "const": "US"
                      },
                      "region": {
                        "enum": [
                          "PA",
                          "IL",
                          "TX"
                        ]
                      },
                      "taxYear": {
                        "const": "2026"
                      },
                      "income": {
                        "type": "number",
                        "minimum": 0,
                        "maximum": 1000000000,
                        "multipleOf": 0.01
                      },
                      "scopeConfirmed": {
                        "const": true
                      }
                    }
                  },
                  {
                    "type": "object",
                    "additionalProperties": false,
                    "required": [
                      "country",
                      "region",
                      "taxYear",
                      "income",
                      "scopeConfirmed"
                    ],
                    "properties": {
                      "country": {
                        "const": "CA"
                      },
                      "region": {
                        "enum": [
                          "AB",
                          "BC",
                          "MB",
                          "NB",
                          "NL",
                          "NT",
                          "NS",
                          "NU",
                          "ON",
                          "PE",
                          "SK",
                          "YT"
                        ]
                      },
                      "taxYear": {
                        "const": "2026"
                      },
                      "income": {
                        "type": "number",
                        "minimum": 0,
                        "maximum": 1000000000,
                        "multipleOf": 0.01
                      },
                      "scopeConfirmed": {
                        "const": true
                      }
                    }
                  },
                  {
                    "type": "object",
                    "additionalProperties": false,
                    "required": [
                      "country",
                      "region",
                      "taxYear",
                      "income",
                      "scopeConfirmed"
                    ],
                    "properties": {
                      "country": {
                        "const": "GB"
                      },
                      "region": {
                        "enum": [
                          "SCT",
                          "RUK"
                        ]
                      },
                      "taxYear": {
                        "const": "2026"
                      },
                      "income": {
                        "type": "integer",
                        "minimum": 0,
                        "maximum": 1000000000,
                        "multipleOf": 1
                      },
                      "scopeConfirmed": {
                        "const": true
                      }
                    }
                  }
                ]
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Scoped regional tax example"
          },
          "400": {
            "description": "Unsupported inputs"
          }
        }
      }
    },
    "/v1/salary/remainder": {
      "post": {
        "operationId": "calculateSalaryRemainder",
        "description": "Scoped salary remainder after modeled income tax and contributions; not actual payslip. Country-specific eligibility and inputs; Singapore calendar 2026 wages assessed in YA 2027 before rebates.",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "oneOf": [
                  {
                    "type": "object",
                    "additionalProperties": false,
                    "required": [
                      "country",
                      "region",
                      "taxYear",
                      "pay",
                      "scopeConfirmed"
                    ],
                    "properties": {
                      "country": {
                        "const": "US"
                      },
                      "region": {
                        "enum": [
                          "TX"
                        ]
                      },
                      "taxYear": {
                        "const": "2026"
                      },
                      "pay": {
                        "type": "number",
                        "minimum": 0,
                        "maximum": 250000,
                        "multipleOf": 0.01
                      },
                      "scopeConfirmed": {
                        "const": true
                      }
                    }
                  },
                  {
                    "type": "object",
                    "additionalProperties": false,
                    "required": [
                      "country",
                      "region",
                      "taxYear",
                      "pay",
                      "scopeConfirmed"
                    ],
                    "properties": {
                      "country": {
                        "const": "GB"
                      },
                      "region": {
                        "enum": [
                          "SCT",
                          "RUK"
                        ]
                      },
                      "taxYear": {
                        "const": "2026"
                      },
                      "pay": {
                        "type": "integer",
                        "minimum": 0,
                        "maximum": 100000,
                        "multipleOf": 1
                      },
                      "scopeConfirmed": {
                        "const": true
                      }
                    }
                  },
                  {
                    "type": "object",
                    "additionalProperties": false,
                    "required": [
                      "country",
                      "region",
                      "taxYear",
                      "pay",
                      "scopeConfirmed"
                    ],
                    "properties": {
                      "country": {
                        "const": "CA"
                      },
                      "region": {
                        "const": "AB"
                      },
                      "taxYear": {
                        "const": "2026"
                      },
                      "pay": {
                        "type": "integer",
                        "minimum": 60000,
                        "maximum": 150000
                      },
                      "scopeConfirmed": {
                        "const": true
                      }
                    }
                  },
                  {
                    "type": "object",
                    "additionalProperties": false,
                    "required": [
                      "country",
                      "region",
                      "taxYear",
                      "pay",
                      "scopeConfirmed"
                    ],
                    "properties": {
                      "country": {
                        "const": "AU"
                      },
                      "region": {
                        "const": "AU"
                      },
                      "taxYear": {
                        "const": "2026"
                      },
                      "pay": {
                        "type": "integer",
                        "minimum": 100000,
                        "maximum": 1000000
                      },
                      "scopeConfirmed": {
                        "const": true
                      }
                    }
                  },
                  {
                    "type": "object",
                    "additionalProperties": false,
                    "required": [
                      "country",
                      "region",
                      "taxYear",
                      "pay",
                      "scopeConfirmed",
                      "epfMonthlyWage",
                      "professionalTaxAnnual"
                    ],
                    "properties": {
                      "country": {
                        "const": "IN"
                      },
                      "region": {
                        "const": "IN"
                      },
                      "taxYear": {
                        "const": "2026"
                      },
                      "pay": {
                        "type": "integer",
                        "minimum": 0,
                        "maximum": 1000000000
                      },
                      "scopeConfirmed": {
                        "const": true
                      },
                      "epfMonthlyWage": {
                        "type": "integer",
                        "minimum": 0,
                        "maximum": 15000
                      },
                      "professionalTaxAnnual": {
                        "type": "integer",
                        "minimum": 0,
                        "maximum": 2500
                      }
                    }
                  },
                  {
                    "type": "object",
                    "additionalProperties": false,
                    "required": [
                      "country",
                      "region",
                      "taxYear",
                      "pay",
                      "scopeConfirmed"
                    ],
                    "properties": {
                      "country": {
                        "const": "SG"
                      },
                      "region": {
                        "const": "SG"
                      },
                      "taxYear": {
                        "const": "2026"
                      },
                      "pay": {
                        "type": "integer",
                        "minimum": 751,
                        "maximum": 100000
                      },
                      "scopeConfirmed": {
                        "const": true
                      }
                    }
                  },
                  {
                    "type": "object",
                    "additionalProperties": false,
                    "required": [
                      "country",
                      "region",
                      "taxYear",
                      "pay",
                      "scopeConfirmed",
                      "annualTaxableIncome",
                      "healthSupplementRate"
                    ],
                    "properties": {
                      "country": {
                        "const": "DE"
                      },
                      "region": {
                        "const": "DE"
                      },
                      "taxYear": {
                        "const": "2026"
                      },
                      "pay": {
                        "type": "number",
                        "minimum": 2500,
                        "maximum": 6450,
                        "multipleOf": 0.01
                      },
                      "scopeConfirmed": {
                        "const": true
                      },
                      "annualTaxableIncome": {
                        "type": "integer",
                        "minimum": 0,
                        "maximum": 77400
                      },
                      "healthSupplementRate": {
                        "type": "number",
                        "minimum": 0,
                        "maximum": 10,
                        "multipleOf": 0.01
                      }
                    }
                  },
                  {
                    "type": "object",
                    "additionalProperties": false,
                    "required": [
                      "country",
                      "region",
                      "taxYear",
                      "pay",
                      "scopeConfirmed",
                      "monthlyBasicSalary"
                    ],
                    "properties": {
                      "country": {
                        "const": "AE"
                      },
                      "region": {
                        "const": "AE"
                      },
                      "taxYear": {
                        "const": "2026"
                      },
                      "pay": {
                        "type": "number",
                        "minimum": 100,
                        "maximum": 1000000,
                        "multipleOf": 0.01
                      },
                      "scopeConfirmed": {
                        "const": true
                      },
                      "monthlyBasicSalary": {
                        "type": "number",
                        "exclusiveMinimum": 0,
                        "maximum": 1000000,
                        "multipleOf": 0.01
                      }
                    }
                  }
                ]
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Scoped example after modeled taxes and employee contributions"
          },
          "400": {
            "description": "Unsupported input"
          }
        }
      }
    },
    "/v1/contributions/calculate": {
      "post": {
        "operationId": "calculateEmployeeContributions",
        "description": "Unverified scoped contribution components only; eligibility must be confirmed. Not complete take-home pay.",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "oneOf": [
                  {
                    "type": "object",
                    "additionalProperties": false,
                    "required": [
                      "country",
                      "taxYear",
                      "income",
                      "scopeConfirmed"
                    ],
                    "properties": {
                      "country": {
                        "const": "CA"
                      },
                      "taxYear": {
                        "const": "2026"
                      },
                      "income": {
                        "type": "number",
                        "minimum": 0,
                        "maximum": 1000000000,
                        "multipleOf": 0.01
                      },
                      "scopeConfirmed": {
                        "const": true
                      }
                    }
                  },
                  {
                    "type": "object",
                    "additionalProperties": false,
                    "required": [
                      "country",
                      "taxYear",
                      "income",
                      "scopeConfirmed"
                    ],
                    "properties": {
                      "country": {
                        "const": "AU"
                      },
                      "taxYear": {
                        "const": "2026"
                      },
                      "income": {
                        "type": "number",
                        "minimum": 100000,
                        "maximum": 1000000000,
                        "multipleOf": 0.01
                      },
                      "scopeConfirmed": {
                        "const": true
                      }
                    }
                  },
                  {
                    "type": "object",
                    "additionalProperties": false,
                    "required": [
                      "country",
                      "taxYear",
                      "income",
                      "scopeConfirmed"
                    ],
                    "properties": {
                      "country": {
                        "const": "IN"
                      },
                      "taxYear": {
                        "const": "2026"
                      },
                      "income": {
                        "type": "integer",
                        "minimum": 0,
                        "maximum": 15000,
                        "multipleOf": 1
                      },
                      "scopeConfirmed": {
                        "const": true
                      }
                    }
                  },
                  {
                    "type": "object",
                    "additionalProperties": false,
                    "required": [
                      "country",
                      "taxYear",
                      "income",
                      "scopeConfirmed",
                      "ageBand"
                    ],
                    "properties": {
                      "country": {
                        "const": "SG"
                      },
                      "taxYear": {
                        "const": "2026"
                      },
                      "income": {
                        "type": "number",
                        "minimum": 0,
                        "maximum": 1000000000,
                        "multipleOf": 0.01,
                        "exclusiveMinimum": 750
                      },
                      "scopeConfirmed": {
                        "const": true
                      },
                      "ageBand": {
                        "enum": [
                          "55-or-under",
                          "56-60",
                          "61-65",
                          "66-70",
                          "over-70"
                        ]
                      }
                    }
                  }
                ]
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Unverified contribution example"
          },
          "400": {
            "description": "Unsupported input"
          }
        }
      }
    },
    "/v1/history/rules": {
      "get": {
        "operationId": "historicalRuleCatalog",
        "responses": {
          "200": {
            "description": "Versioned enacted ordinary income-tax schedules; unverified preview"
          }
        }
      }
    },
    "/v1/history/compare": {
      "post": {
        "operationId": "compareHistoricalTax",
        "description": "Compare two chronological rule versions for the same country. Taxable income before credits/offsets; not total tax.",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "country",
                  "firstRuleId",
                  "secondRuleId",
                  "taxableIncome",
                  "scopeConfirmed"
                ],
                "properties": {
                  "country": {
                    "enum": [
                      "US",
                      "AU",
                      "IN",
                      "GB",
                      "CA"
                    ]
                  },
                  "firstRuleId": {
                    "enum": [
                      "US-2024-single-ordinary-v1",
                      "US-2025-single-ordinary-v1",
                      "US-2026-single-ordinary-v1",
                      "AU-2024-25-resident-ordinary-v1",
                      "AU-2025-26-resident-ordinary-v1",
                      "AU-2026-27-resident-ordinary-v1",
                      "AU-2027-28-resident-ordinary-v1",
                      "CA-2025-ordinary-v1",
                      "CA-2026-ordinary-v1",
                      "GB-2024-25-ordinary-v1",
                      "GB-2025-26-ordinary-v1",
                      "GB-2026-27-ordinary-v1",
                      "IN-2024-25-ordinary-v1",
                      "IN-2025-26-ordinary-v1"
                    ]
                  },
                  "secondRuleId": {
                    "enum": [
                      "US-2024-single-ordinary-v1",
                      "US-2025-single-ordinary-v1",
                      "US-2026-single-ordinary-v1",
                      "AU-2024-25-resident-ordinary-v1",
                      "AU-2025-26-resident-ordinary-v1",
                      "AU-2026-27-resident-ordinary-v1",
                      "AU-2027-28-resident-ordinary-v1",
                      "CA-2025-ordinary-v1",
                      "CA-2026-ordinary-v1",
                      "GB-2024-25-ordinary-v1",
                      "GB-2025-26-ordinary-v1",
                      "GB-2026-27-ordinary-v1",
                      "IN-2024-25-ordinary-v1",
                      "IN-2025-26-ordinary-v1"
                    ]
                  },
                  "taxableIncome": {
                    "type": "number",
                    "minimum": 0,
                    "maximum": 1000000000,
                    "multipleOf": 0.01
                  },
                  "scopeConfirmed": {
                    "const": true
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Scoped comparison with rule snapshots"
          },
          "400": {
            "description": "Unsupported input"
          }
        }
      }
      },
      "/v1/business/indirect-tax": {
        "post": {
          "operationId": "calculateIndirectTaxComponent",
          "description": "One explicitly confirmed 2026 standard-rated supply in a supported jurisdiction. Not a VAT/GST return or determination of place of supply, registration or input-credit entitlement.",
          "requestBody": {
            "required": true,
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "additionalProperties": false,
                  "required": [
                    "country",
                    "jurisdiction",
                    "taxYear",
                    "transactionDate",
                    "amount",
                    "mode",
                    "sellerRegistered",
                    "standardRatedSupply",
                    "scopeConfirmed"
                  ],
                  "properties": {
                    "country": {
                      "enum": [
                        "GB",
                        "DE",
                        "AU",
                        "SG",
                        "AE",
                        "CA",
                        "US"
                      ]
                    },
                    "jurisdiction": {
                      "type": "string"
                    },
                    "taxYear": {
                      "const": "2026"
                    },
                    "transactionDate": {
                      "type": "string",
                      "format": "date"
                    },
                    "amount": {
                      "type": "number",
                      "minimum": 0,
                      "multipleOf": 0.01
                    },
                    "mode": {
                      "enum": [
                        "exclusive",
                        "inclusive"
                      ]
                    },
                    "sellerRegistered": {
                      "const": true
                    },
                    "standardRatedSupply": {
                      "const": true
                    },
                    "scopeConfirmed": {
                      "const": true
                    }
                  }
                }
              }
            }
          },
          "responses": {
            "200": {
              "description": "Sample indirect tax component with rule provenance and limitations"
            },
            "400": {
              "description": "Unsupported or out-of-scope transaction"
            }
          }
        }
      },
      "/v1/business/corporate-tax": {
        "post": {
          "operationId": "calculateCorporateTaxComponent",
          "description": "Tax on user-established 2026 taxable profit in supported countries. Eligibility and relief inputs must be independently established; not a corporate tax return.",
          "requestBody": {
            "required": true,
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "additionalProperties": false,
                  "required": [
                    "country",
                    "taxYear",
                    "taxableProfit",
                    "scopeConfirmed"
                  ],
                  "properties": {
                    "country": {
                      "enum": [
                        "US",
                        "GB",
                        "DE",
                        "CA",
                        "AU",
                        "SG",
                        "AE"
                      ]
                    },
                    "taxYear": {
                      "const": "2026"
                    },
                    "taxableProfit": {
                      "type": "number",
                      "minimum": 0,
                      "multipleOf": 0.01
                    },
                    "eligibleSmallBusinessProfit": {
                      "type": "number",
                      "minimum": 0,
                      "multipleOf": 0.01
                    },
                    "smallBusinessEligibilityConfirmed": {
                      "type": "boolean"
                    },
                    "reliefScheme": {
                      "enum": [
                        "none",
                        "partial",
                        "startup"
                      ]
                    },
                    "reliefEligibilityConfirmed": {
                      "type": "boolean"
                    },
                    "scopeConfirmed": {
                      "const": true
                    }
                  }
                }
              }
            }
          },
          "responses": {
            "200": {
              "description": "Sample corporate income tax component with source and scope"
            },
            "400": {
              "description": "Unsupported or unconfirmed corporate tax input"
            }
          }
        }
      },
      "/v1/property/transfer-tax": {
        "post": {
          "operationId": "calculateScopedPropertyTransferCharge",
          "description": "Selected date-bound property transfer tax or registration-fee examples. Jurisdiction and transaction scope must be explicitly confirmed; not total closing costs.",
          "requestBody": {
            "required": true,
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "additionalProperties": false,
                  "required": [
                    "jurisdiction",
                    "taxableConsideration",
                    "transactionDate",
                    "scopeConfirmed"
                  ],
                  "properties": {
                    "jurisdiction": {
                      "enum": [
                        "DE-BE",
                        "CA-ON",
                        "IN-DL-male",
                        "IN-DL-female",
                        "US-NY",
                        "AU-NSW",
                        "AE-DU"
                      ]
                    },
                    "taxableConsideration": {
                      "type": "number",
                      "minimum": 0,
                      "multipleOf": 0.01
                    },
                    "transactionDate": {
                      "type": "string",
                      "format": "date"
                    },
                    "scopeConfirmed": {
                      "const": true
                    }
                  }
                }
              }
            }
          },
          "responses": {
            "200": {
              "description": "Selected property transfer component with official source"
            },
            "400": {
              "description": "Unsupported jurisdiction or transaction"
            }
          }
        }
      },
      "/v1/investment/scoped-gain": {
        "post": {
          "operationId": "calculateScopedInvestmentGainComponent",
          "description": "Selected capital-gain inclusion or tax components for Canada, Germany, Singapore and UAE using an already established positive gain. Not a total capital-gains assessment.",
          "requestBody": {
            "required": true,
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "additionalProperties": false,
                  "required": [
                    "jurisdiction",
                    "confirmedNetGain",
                    "transactionDate",
                    "scopeConfirmed"
                  ],
                  "properties": {
                    "jurisdiction": {
                      "enum": [
                        "CA",
                        "DE",
                        "SG",
                        "AE"
                      ]
                    },
                    "confirmedNetGain": {
                      "type": "number",
                      "minimum": 0,
                      "multipleOf": 0.01
                    },
                    "transactionDate": {
                      "type": "string",
                      "format": "date"
                    },
                    "scopeConfirmed": {
                      "const": true
                    }
                  }
                }
              }
            }
          },
          "responses": {
            "200": {
              "description": "Selected investment tax component with limitations"
            },
            "400": {
              "description": "Unsupported investment scope"
            }
          }
        }
      },
      "/v1/treaty/credit": {
        "post": {
          "operationId": "calculateGenericTreatyCreditLimit",
          "description": "Arithmetic-only one-item foreign tax credit limited by four user-established amounts. Does not determine treaty eligibility, residence or source.",
          "requestBody": {
            "required": true,
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "additionalProperties": false,
                  "required": [
                    "currency",
                    "worldwideIncome",
                    "foreignSourceIncome",
                    "domesticTaxOnWorldwideIncome",
                    "foreignTaxPaid",
                    "treatyLimit",
                    "taxOnForeignItem",
                    "scopeConfirmed"
                  ],
                  "properties": {
                    "currency": {
                      "type": "string",
                      "pattern": "^[A-Z]{3}$"
                    },
                    "worldwideIncome": {
                      "type": "number",
                      "minimum": 0,
                      "multipleOf": 0.01
                    },
                    "foreignSourceIncome": {
                      "type": "number",
                      "minimum": 0,
                      "multipleOf": 0.01
                    },
                    "domesticTaxOnWorldwideIncome": {
                      "type": "number",
                      "minimum": 0,
                      "multipleOf": 0.01
                    },
                    "foreignTaxPaid": {
                      "type": "number",
                      "minimum": 0,
                      "multipleOf": 0.01
                    },
                    "treatyLimit": {
                      "type": "number",
                      "minimum": 0,
                      "multipleOf": 0.01
                    },
                    "taxOnForeignItem": {
                      "type": "number",
                      "minimum": 0,
                      "multipleOf": 0.01
                    },
                    "scopeConfirmed": {
                      "const": true
                    }
                  }
                }
              }
            }
          },
          "responses": {
            "200": {
              "description": "Arithmetic credit limit with explicit non-statutory limitations"
            },
            "400": {
              "description": "Invalid or inconsistent credit amounts"
            }
          }
        }
      },
      "/v1/treaty/confirmed-credit": {
        "post": {
          "operationId": "calculateConfirmedTreatyCreditComponent",
          "description": "Selected bilateral treaty credit examples after the user independently establishes treaty eligibility and domestic limits. Historical or narrow country-specific scope applies.",
          "requestBody": {
            "required": true,
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "additionalProperties": false,
                  "required": [
                    "jurisdiction",
                    "foreignTaxPaid",
                    "treatyPermittedTax",
                    "domesticLimit",
                    "availableDomesticTax",
                    "scopeConfirmed"
                  ],
                  "properties": {
                    "jurisdiction": {
                      "enum": [
                        "CA-GB",
                        "AU-GB",
                        "DE-GB",
                        "SG-GB",
                        "AE-GB"
                      ]
                    },
                    "foreignTaxPaid": {
                      "type": "number",
                      "minimum": 0,
                      "multipleOf": 0.01
                    },
                    "treatyPermittedTax": {
                      "type": "number",
                      "minimum": 0,
                      "multipleOf": 0.01
                    },
                    "domesticLimit": {
                      "type": "number",
                      "minimum": 0,
                      "multipleOf": 0.01
                    },
                    "availableDomesticTax": {
                      "type": "number",
                      "minimum": 0,
                      "multipleOf": 0.01
                    },
                    "scopeConfirmed": {
                      "const": true
                    }
                  }
                }
              }
            }
          },
          "responses": {
            "200": {
              "description": "Selected bilateral credit component with scope and sources"
            },
            "400": {
              "description": "Unsupported treaty or inconsistent credit inputs"
            }
          }
        }
      },
      "/v1/employer-payroll/fica": {
        "post": {
          "operationId": "calculateUsEmployerFicaComponent",
          "description": "US 2026 employer Social Security and Medicare share for one employee and one employer. Excludes FUTA, state unemployment and special wage classes.",
          "requestBody": {
            "required": true,
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "additionalProperties": false,
                  "required": [
                    "annualWages",
                    "scopeConfirmed"
                  ],
                  "properties": {
                    "annualWages": {
                      "type": "number",
                      "minimum": 0,
                      "multipleOf": 0.01
                    },
                    "scopeConfirmed": {
                      "const": true
                    }
                  }
                }
              }
            }
          },
          "responses": {
            "200": {
              "description": "Employer FICA component and wage-base source metadata"
            },
            "400": {
              "description": "Unsupported employer payroll input"
            }
          }
        }
      }
      },
      "/v1/treaty/uk-india-credit": {
        "post": {
          "operationId": "calculateUkIndiaTreatyCreditComponent",
          "description": "UK-side one-item India-source foreign tax credit example for tax year 2025–26. All eligibility and domestic limits must be independently established; not a tax-credit claim.",
          "requestBody": {
            "required": true,
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "additionalProperties": false,
                  "required": [
                    "foreignTaxPaidGbp",
                    "treatyEligibleCapGbp",
                    "ukTaxWithIncome",
                    "ukTaxWithoutIncome",
                    "scopeConfirmed"
                  ],
                  "properties": {
                    "foreignTaxPaidGbp": {
                      "type": "number",
                      "minimum": 0,
                      "multipleOf": 0.01
                    },
                    "treatyEligibleCapGbp": {
                      "type": "number",
                      "minimum": 0,
                      "multipleOf": 0.01
                    },
                    "ukTaxWithIncome": {
                      "type": "number",
                      "minimum": 0,
                      "multipleOf": 0.01
                    },
                    "ukTaxWithoutIncome": {
                      "type": "number",
                      "minimum": 0,
                      "multipleOf": 0.01
                    },
                    "scopeConfirmed": {
                      "const": true
                    }
                  }
                }
              }
            }
          },
          "responses": {
            "200": {
              "description": "UK-side treaty credit component with source provenance"
            },
            "400": {
              "description": "Unsupported or inconsistent treaty inputs"
            }
          }
        }
      },
      "/v1/business/scoped-corporate-tax": {
        "post": {
          "operationId": "calculateScopedCorporateTaxComponent",
          "description": "Selected national corporate tax components on already established taxable profit. Jurisdiction-specific eligibility is supplied by the caller; not a corporate return.",
          "requestBody": {
            "required": true,
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "additionalProperties": false,
                  "required": [
                    "jurisdiction",
                    "taxableProfit",
                    "scopeConfirmed"
                  ],
                  "properties": {
                    "jurisdiction": {
                      "enum": [
                        "GB",
                        "AE",
                        "AU-base",
                        "AU-full",
                        "US",
                        "CA-general",
                        "CA-small",
                        "DE",
                        "SG-PTE",
                        "SG-startup",
                        "IN-115BAA"
                      ]
                    },
                    "taxableProfit": {
                      "type": "number",
                      "minimum": 0,
                      "multipleOf": 0.01
                    },
                    "scopeConfirmed": {
                      "const": true
                    }
                  }
                }
              }
            }
          },
          "responses": {
            "200": {
              "description": "Selected corporate tax component and source provenance"
            },
            "400": {
              "description": "Unsupported or unconfirmed corporate scope"
            }
          }
        }
      },
      "/v1/property/uk-sdlt": {
        "post": {
          "operationId": "calculateUkResidentialSdlt",
          "description": "England and Northern Ireland ordinary residential freehold SDLT example. Higher rates, non-resident surcharge and other reliefs are excluded.",
          "requestBody": {
            "required": true,
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "additionalProperties": false,
                  "required": [
                    "consideration",
                    "buyerScope",
                    "transactionDate",
                    "scopeConfirmed"
                  ],
                  "properties": {
                    "consideration": {
                      "type": "integer",
                      "minimum": 0,
                      "maximum": 1000000000
                    },
                    "buyerScope": {
                      "enum": [
                        "ordinary",
                        "first-time"
                      ]
                    },
                    "transactionDate": {
                      "type": "string",
                      "format": "date"
                    },
                    "scopeConfirmed": {
                      "const": true
                    }
                  }
                }
              }
            }
          },
          "responses": {
            "200": {
              "description": "UK residential SDLT component"
            },
            "400": {
              "description": "Unsupported property transaction"
            }
          }
        }
      },
      "/v1/property/sg-bsd": {
        "post": {
          "operationId": "calculateSingaporeBuyerStampDuty",
          "description": "Singapore buyer's stamp duty for one ordinary pure residential or non-residential acquisition. ABSD, SSD and other charges are excluded.",
          "requestBody": {
            "required": true,
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "additionalProperties": false,
                  "required": [
                    "purchasePrice",
                    "marketValue",
                    "propertyType",
                    "transactionDate",
                    "scopeConfirmed"
                  ],
                  "properties": {
                    "purchasePrice": {
                      "type": "number",
                      "minimum": 0,
                      "multipleOf": 0.01
                    },
                    "marketValue": {
                      "type": "number",
                      "minimum": 0,
                      "multipleOf": 0.01
                    },
                    "propertyType": {
                      "enum": [
                        "residential",
                        "nonresidential"
                      ]
                    },
                    "transactionDate": {
                      "type": "string",
                      "format": "date"
                    },
                    "scopeConfirmed": {
                      "const": true
                    }
                  }
                }
              }
            }
          },
          "responses": {
            "200": {
              "description": "Singapore buyer's stamp duty component"
            },
            "400": {
              "description": "Unsupported property transaction"
            }
          }
        }
      },
      "/v1/treaty/scoped-credit": {
        "post": {
          "operationId": "calculateScopedBilateralTreatyCredit",
          "description": "Selected US–UK or India–UK one-item foreign tax credit limitation. Eligibility, residence, sourcing and domestic tax bases must be independently established.",
          "requestBody": {
            "required": true,
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "additionalProperties": false,
                  "required": [
                    "jurisdiction",
                    "foreignTaxPaid",
                    "treatyPermittedTax",
                    "domesticTax",
                    "worldwideTaxableIncome",
                    "foreignTaxableIncome",
                    "domesticTaxOnItem",
                    "scopeConfirmed"
                  ],
                  "properties": {
                    "jurisdiction": {
                      "enum": [
                        "US-GB",
                        "IN-GB"
                      ]
                    },
                    "foreignTaxPaid": {
                      "type": "number",
                      "minimum": 0,
                      "multipleOf": 0.01
                    },
                    "treatyPermittedTax": {
                      "type": "number",
                      "minimum": 0,
                      "multipleOf": 0.01
                    },
                    "domesticTax": {
                      "type": "number",
                      "minimum": 0,
                      "multipleOf": 0.01
                    },
                    "worldwideTaxableIncome": {
                      "type": "number",
                      "minimum": 0,
                      "multipleOf": 0.01
                    },
                    "foreignTaxableIncome": {
                      "type": "number",
                      "minimum": 0,
                      "multipleOf": 0.01
                    },
                    "domesticTaxOnItem": {
                      "type": "number",
                      "minimum": 0,
                      "multipleOf": 0.01
                    },
                    "scopeConfirmed": {
                      "const": true
                    }
                  }
                }
              }
            }
          },
          "responses": {
            "200": {
              "description": "Selected treaty credit component"
            },
            "400": {
              "description": "Unsupported or inconsistent treaty scope"
            }
          }
        }
      },
  }
};
