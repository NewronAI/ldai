import nextConnect from "next-connect";
import mongodbClient from "../../../src/node/mongodb-client";

const getRawDataStatsHandler = nextConnect({
    onNoMatch(req, res) {
        res.status(405).json({ error: `Method '${req.method}' Not Allowed` });
    },
    onError(error, req, res) {
        res.status(500).json({ error: `Sorry something Happened! ${error.message}` });
    }
})

getRawDataStatsHandler.get(async (req, res) => {
    res.json = (data) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(data));
    }

    await mongodbClient.connect();
    const db = mongodbClient.db("vaani");

    const rawHashesCollection = db.collection("automated-qc-hashes");

    const documentCollection = db.collection(`automated-qc-stats`);


    const latestHash = (await rawHashesCollection.find().sort({
        uploadedAt: -1
    }).limit(1).toArray())?.[0];

    const stats = (await documentCollection.find({hash: latestHash.hash}).project({_id: 0, hash: 0}).toArray()).map((stat) => ({
        id: stat.district,
        ...stat,
    }));

    const stateWiseAggregatesTotal = (await documentCollection.aggregate([
        {
            $match: {
                hash: latestHash.hash
            }
        },
        {
            $group: {
                _id: "$state",
                state: {
                    $first: "$state"
                },
                duration_hrs: {
                    $sum: "$duration_hrs"
                },
                no_of_speakers: {
                    $sum: "$no_of_speakers"
                }
            }
        }]).project({_id: 0}).toArray()).map((stat) => ({
            id: stat.state,
            ...stat,
        }));

    // console.log({ stateWiseAggregatesTotal});

    const totalAggregates = (await documentCollection.aggregate([
        {
            $match: {
                hash: latestHash.hash
            }
        },
        {
            $group: {
                _id: null,
                total_duration_hrs: {
                    $sum: "$duration_hrs"
                },
                total_no_of_speakers: {
                    $sum: "$no_of_speakers"
                }
            }
        }
        ]).project({_id: 0}).toArray())[0];

    console.log({totalAggregates});

    res.statusCode = 200;
    res.json({
        data : stats,
        stateWiseAggregates: stateWiseAggregatesTotal,
        aggregates: totalAggregates
    });

    await mongodbClient.close();
})

export default getRawDataStatsHandler;