param(
  [string]$Mode = "all",
  [string]$Value = ""
)

switch ($Mode) {
  "booking" { Get-Content .\logs\application-*.log | Select-String '"category":"booking"' }
  "wallet"  { Get-Content .\logs\application-*.log | Select-String '"category":"wallet"' }
  "session" { Get-Content .\logs\application-*.log | Select-String '"category":"session"' }
  "mqtt"    { Get-Content .\logs\application-*.log | Select-String '"category":"mqtt"' }
  "error"   { Get-Content .\logs\error-*.log }
  "user"    { Get-Content .\logs\application-*.log | Select-String $Value }
  "request" { Get-Content .\logs\application-*.log | Select-String $Value }
  default   { Get-Content .\logs\application-*.log }
}
