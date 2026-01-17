# System Flow (Golden Flow)

1. User opens Android app and views nearby chargers
2. User selects a charger
3. Booking hold is created (valid for 2 minutes)
4. Payment is simulated and booking is confirmed
5. User arrives within allowed grace period
6. User scans QR code on charger
7. Backend validates booking and charger state
8. Unlock command is sent to charger
9. Charger door unlocks
10. Current detected → charging starts
11. Charging ends by quota or user action
12. Exit grace period is given
13. Door closed → session finalized
14. Charger becomes available again

This flow is locked for Week-1 and Week-2 development.
