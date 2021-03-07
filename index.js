const express = require("express");
const cors = require("cors");
const monk = require("monk");
const { exists, copyFile } = require("fs");
const { time } = require("console");
const { response } = require("express");
const { Cipher } = require("crypto");

const app = express();

const PORT = process.env.PORT || 5000;

const db = monk(process.env.MONGO_DB_URI || "localhost/MeetLinkOpener");
const timetables = db.get("timetables");
const admins = db.get("admin");

console.log("Server at: " + PORT);

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.json({
        status: 200,
        message: "Server Here"
    });
});

app.get("/GetTimeTable", (req, res) => {
    timetables.find().then(timetables => {
        res.json(timetables);
    });
});

app.get("/Login", (req, res) => {
    admins.find().then(admins => {
        res.json(admins);
    });
});

app.post("/GetTimeTable", (req, res) => {
    /*res.json({
        status: 200,
        message: "Server Here"
    });*/
    timetables.find().then(timetables => {
        correctTimetable = [];
        for (let i = 0; i < timetables.length; i++) {
            const timetable = timetables[i];
            if (timetable.name === req.body.name && timetable.password === req.body.password) {
                correctTimetable = timetable;
            }
        }
        console.log(correctTimetable);
        if (correctTimetable === [] || correctTimetable.length === 0) {
            console.log("ERROR");
            res.json({
                status: 502,
                message: "Error Wrong Timetable"
            });
            return;
        }
        correctTimetable.lectures = SortTimeTableByDay(correctTimetable.lectures); // Sorts so they are in the correct day
        correctTimetable.lectures = SortTimeTableByTime(correctTimetable.lectures); // Sorts so they are in the correct time
        console.log(correctTimetable);
        res.json(correctTimetable);
    });
});

app.post("/GetLogInInformation", (req, res) => {
    admins.find().then(admins => {
        const targetAdmin = req.body;
        for (let i = 0; i < admins.length; i++) {
            const admin = admins[i];
            if (admin.name.toString() === targetAdmin.name.toString()) {
                if (admin.password.toString() === targetAdmin.password.toString()) {
                    res.json(admin);
                    return;
                }
            };
        }

        return undefined;
    });
});

app.post("/GetTimetablesWithID", (req, res) => {
    timetables.find().then(timetables => {
        const targetIDS = req.body.ids;
        let result = [];
        console.log("TEST");
        for (let i = 0; i < timetables.length; i++) {
            const timetable = timetables[i];
            if (targetIDS.includes(timetable._id.toString())) {
                console.log("TES");
                result.push(timetables[i]);
            }
        }
        console.log(result);
        res.json(result);
    });
});

app.post("/SortTimetable", (req, res) => {
    const timetable = req.body.timetable;
    console.log(timetable);
    console.log("---");
    let correctTimetable = SortTimeTableByDay(timetable);
    correctTimetable = SortTimeTableByTime(correctTimetable);
    console.log(correctTimetable);
    console.log("---");
    res.json(correctTimetable);
});

app.post("/SaveTimetable", (req, res) => {
    const request = req.body;
    console.log(request);
    //timetables.updateById(request.id,)
    timetables.findOne(request.id).then(timetable => {
        console.log("---------");
        console.log(timetable);
        console.log("REQUEST ID SAVE");
        console.log(request.id);
        console.log("---------");
        const newTimetable = {
            name: timetable.name,
            password: timetable.password,
            oneMinuteBefore: timetable.oneMinuteBefore,
            lectures: request.timetable
        }
        timetables.update(request.id, { $set: newTimetable }).then(k => {
            timetables.findOne(request.id).then(resp => {
                console.log("YESYSEY");
                console.log(resp);
                res.json(resp);
            });
        });

    });
});

app.post("/CreateLecture", (req, res) => {
    console.log(req.body);
    timetables.find().then(timetables => {
        const targetID = req.body.id;
        for (let i = 0; i < timetables.length; i++) {
            const lecture = timetables[i];
            if (lecture._id.toString() === targetID.toString()) {
                console.log(timetables[i]);
                const currentLectures = timetables[i].lectures;
                currentLectures.push(req.body.lecture);
                const newTimetable = {
                    name: timetables[i].name,
                    password: timetables[i].password,
                    oneMinuteBefore: timetables[i].oneMinuteBefore,
                    lectures: currentLectures
                }
                UpdateTimetableWithNewLecture(newTimetable, timetables[i]._id, (result => {
                    console.log(result);
                    res.json(result);

                }));
            }
        }
    });
});

function UpdateTimetableWithNewLecture(timetable, id, callback) {
    timetables.update(id, { $set: timetable }).then(k => {
        timetables.findOne(id).then(resp => {
            console.log("YESYSEY");
            console.log(resp);
            callback(resp);
        });
    });
}

function SortTimeTableByTime(timetable) {
    /* USE LATER WITH CALCULATING THE TIME
    let defaultTime = "January 07, 2005 ";

    console.log(timetable);
    let t1 = timetable[0].time;
    let t2 = timetable[1].time;
    console.log(t1);
    console.log(t2);
    let newTime = defaultTime + t2 + ":00";
    let d = new Date(newTime);
    console.log(d);
*/
    let currentHour = 0;
    let currentMinute = 0;

    let newTimetable = [];

    const OccurensOfDay = GetDaysInTimeTable(timetable);
    currentDay = 0;

    for (let j = 0; j < 7; j++) {
        currentHour = 0;
        currentMinute = 0;
        while (currentHour < "24") {
            currentTime = MakeTimeString(currentHour, currentMinute);

            for (let i = 0; i < timetable.length; i++) {
                const lecture = timetable[i];
                if (lecture.time.toString() === currentTime) {
                    if (NumberToDay(currentDay) === lecture.day.toString()) {
                        newTimetable.push(lecture);
                    }
                }
            }

            currentMinute += 1;
            if (currentMinute === 60) {
                currentMinute = 0;
                currentHour += 1;
            }
        }
        currentDay += 1;
    }
    console.log(OccurensOfDay);
    return newTimetable;
}

function GetDaysInTimeTable(timetable) {
    let different = [0, 0, 0, 0, 0, 0, 0];
    for (let i = 0; i < timetable.length; i++) {
        const lecture = timetable[i];
        const dayIndex = DayToNumber(lecture.day);
        different[dayIndex] += 1;
    }
    return different;
}

function MakeTimeString(hour, minute) {
    return AddAZero(hour) + ":" + AddAZero(minute);
}

function AddAZero(number) {
    if (number <= 9) { number = "0" + number.toString(); }
    return number.toString();
}

function SortTimeTableByDay(timetable) {
    newTimetable = [];
    currentDay = 0;

    while (currentDay < 7) {
        //console.log("In sort");
        for (let i = 0; i < timetable.length; i++) {
            const lecture = timetable[i];
            day = NumberToDay(currentDay);

            if (day === lecture.day) {
                newTimetable.push(timetable[i]);
            }
        }
        currentDay += 1;
    }

    return newTimetable;
}

function NumberToDay(number) {
    numberDays = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
    return (numberDays[number]);
}

function DayToNumber(day) {
    if (day === "Mo") { return 0; }
    if (day === "Tu") { return 1; }
    if (day === "We") { return 2; }
    if (day === "Th") { return 3; }
    if (day === "Fr") { return 4; }
    if (day === "Sa") { return 5; }
    if (day === "Su") { return 6; }
}

app.post("/Login", (req, res) => {
    console.log(req.body);
    if (req.body.name === "" || req.body.password === "") {
        res.json({
            status: 502,
            message: "ERROR"
        });
        return;
    }

    if (req.body.isCreatingOn === "on") {
        toInsert = {
            name: req.body.name.toString(),
            password: req.body.password.toString(),
            created: new Date(),
            timetables: []
        }
        admins.insert(toInsert).then(result => {
            res.json(result);
        });
    } else {
        CheckIfAdminExists(req, function(inDatabase) {
            if (inDatabase) {
                toSend = {
                    name: req.body.name,
                    password: req.body.password
                };
                res.json(toSend);
            } else {

                res.json({
                    status: 502,
                    message: "ERROR"
                });
            }
        });

    }
});

app.post("/CreateTimeTable", (req, res) => {
    console.log(req.body);

    if (IsTimeTableCorrect(req.body) === false) {
        res.json({
            status: 502,
            message: "ErrowWithData"
        });
        return;
    }

    const toInsert = {

        name: req.body.name,
        password: req.body.password,
        oneMinuteBefore: req.body.oneMinutebefore,
        lectures: req.body.lectures
    }

    timetables.insert(toInsert).then(response => {
        console.log(response);
        InsertTimetableToAdmin(req.body, response, (result) => {
            console.log("timetables");
            console.log(result);
            console.log(result.timetables);
            let timetables = result.timetables;
            if (timetables === undefined) {
                timetables = [
                    response._id
                ]
            } else {
                timetables.push(response._id);
            }
            AdminUpdateTimetables(timetables, result._id, () => {
                console.log(timetables);
                res.json(response);
            });
        });
    });
});

app.post("/DeleteTimetableID", (req, res) => {
    timetables.remove(req.body.timetableID).then(k => {
        res.json("Deleted");
    });
});

function AdminUpdateTimetables(newTimetables, adminID, callback) {
    admins.findOne(adminID).then(adminAccount => {
        console.log("-------");
        console.log(adminAccount);
        const toInsert = {
            name: adminAccount.name,
            password: adminAccount.password,
            created: adminAccount.created,
            timetables: newTimetables
        }
        admins.update(adminID, { $set: toInsert }).then(k => {
            console.log(k);
            callback();
        });
    });
}

function InsertTimetableToAdmin(req, timetable, callback) {
    admins.find().then(adminAccounts => {
        for (let i = 0; i < adminAccounts.length; i++) {
            const admin = adminAccounts[i];
            if (admin.name.toString() === req.accountName.toString() && admin.password.toString() === req.accountPassword.toString()) {
                console.log(admin);
                console.log("TEST");
                callback(admin);
                return;
            }
        }
    });
}

function IsTimeTableCorrect(body) {
    if (body.name === "" || body.password === "" || body.lectures === []) {
        return false;
    }

    lectures = body.lectures;

    for (let i = 0; i < lectures.length; i++) {
        const lecture = lectures[i];
        if (lecture.url === "" || lecture.time === "") {
            return false;
        }
    }

    return true;
}

function CheckIfAdminExists(req, callback) {
    admins.find().then(accounts => {
        for (let i = 0; i < accounts.length; i++) {
            if (accounts[i].name === req.body.name.toString() && accounts[i].password === req.body.password.toString()) {
                callback(true);
                return;
            }
        }
        callback(false);
    });
}

app.listen(PORT, () => {
    console.log("Listening on port 5000");
});