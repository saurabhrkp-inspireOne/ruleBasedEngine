const { QueryTypes, Sequelize } = require('sequelize');
const squel = require('squel');
const squelMssql = squel.useFlavour('mssql');
const { objectify } = require('../helpers');

/**
 * Get User, Company, Demographic Key
 * @param {Sequelize} mysqlConnection
 * @param {Array} userIds
 */
exports.getUserCompanyDemographicKey = async (mysqlConnection, userIds) => {
  let mainQuery = squel.select()
    .field(`U.id AS userId`)
    .field(`FT.rule_demographic_key`)
    .from(`users AS U`)
    .join(`feature_toggles AS FT ON FT.client_id = U.comp_id`)
    .where(`U.id IN ?`, userIds);

  const userCompanyDemographicKey = await mysqlConnection.query(mainQuery.toString(), { type: QueryTypes.SELECT });
  console.log({ userCompanyDemographicKey });
  if (userCompanyDemographicKey.length === 0) return false;
  const { rule_demographic_key } = userCompanyDemographicKey[0];

  let userQuery = squel.select()
    .field(`TRIM(UPPER(U.${rule_demographic_key})) AS demographic_key`)
    .field(`U.comp_id AS companyId`)
    .field(`U.email AS userEmail`)
    .from(`users AS U`).where(`U.id in ?`, userIds)
    .group(`U.${rule_demographic_key}`);

  const userDemographicKey = await mysqlConnection.query(userQuery.toString(), { type: QueryTypes.SELECT });
  console.log({ userDemographicKey });
  if (userDemographicKey.length === 0) return false;

  return userDemographicKey;
};

/**
 * Get User, Levels, Demographic Key
 * @param {Sequelize} mysqlConnection
 * @param {Number} companyId
 * @param {String} demographicKey
 */
exports.getUserLevelsByDemographicKey = async (mysqlConnection, companyId, demographicKey) => {
  let mainQuery = squel.select()
    .field(`DKL.levelId`)
    .field(`DKL.order`)
    .from(`demographic_key_levels AS DKL`)
    .where(`DKL.companyId = ?`, companyId)
    .where(`DKL.demographicKey = ?`, demographicKey)
    .where(`DKL.deleteFlag = ?`, 0)
    .order(`DKL.order`);

  const userLevelsByDemographicKey = await mysqlConnection.query(mainQuery.toString(), { type: QueryTypes.SELECT });
  return userLevelsByDemographicKey;
};

/**
 * Get Module and Level details for Challenge
 * @param {Sequelize} mysqlConnection
 * @param {Array} challengeIds
 */
exports.getModuleLevelByChallenge = async (mysqlConnection, challengeIds) => {
  let mainQuery = squel.select()
    .field(`LMM.moduleId`)
    .field(`LMM.levelId`)
    .from(`challenges AS C`)
    .join(`level_module_mapping AS LMM ON LMM.moduleId = C.module_id`)
    .where(`C.id IN ?`, challengeIds)
    .group(`LMM.moduleId, LMM.levelId`);

  const challengeModuleLevel = await mysqlConnection.query(mainQuery.toString(), { type: QueryTypes.SELECT });
  return challengeModuleLevel;
};

/**
 * Get Module by Level
 * @param {Sequelize} mysqlConnection
 * @param {Array} levelIds
 */
exports.getAllModuleInLevel = async (mysqlConnection, levelIds) => {
  let mainQuery = squel.select()
    .field(`moduleId`)
    .field(`levelId`)
    .field(`mandatory`)
    .from(`level_module_mapping`)
    .where(`levelId IN ?`, levelIds)
    .where(`deleteFlag = ?`, 0);

  const allModuleInLevel = await mysqlConnection.query(mainQuery.toString(), { type: QueryTypes.SELECT });
  return allModuleInLevel;
};

/**
 * Get Level Details from LevelId
 * @param {Sequelize} mysqlConnection
 * @param {Array} levelIds
 */
exports.getLevelDetails = async (mysqlConnection, levelIds) => {
  let mainQuery = squel.select()
    .field(`id AS levelId`)
    .field(`name AS levelName`)
    .field(`criteria AS levelCriteria`)
    .from(`levels`)
    .where(`id IN ?`, levelIds)
    .where(`deleteFlag = ?`, 0);

  const levelDetails = await mysqlConnection.query(mainQuery.toString(), { type: QueryTypes.SELECT });
  return levelDetails;
};

/**
 * Update User Level
 * @param {Sequelize} mysqlConnection
 * @param {Number} userId
 * @param {Number} levelId
 * @param {Object} completions
 */
exports.updateUserLevelCompletion = async (mysqlConnection, userId, levelId, completions) => {
  let findQuery = squel.select()
    .field(`id`)
    .from(`user_level_completion`)
    .where(`userId = ?`, userId)
    .where(`levelId = ?`, levelId)
    .where(`deleteFlag = ?`, 0);

  let { modulesCompleted, totalScore, overAllChallengesCompletion, totalChallengesCompleted, totalChallengesLaunched } = completions;
  const completionCriteria = { modulesCompleted, totalChallengesCompleted, totalChallengesLaunched };

  const updateRow = await mysqlConnection.query(findQuery.toString(), { type: QueryTypes.SELECT });
  console.log({ updateRow });

  let result;
  if (updateRow.length > 0) {
    let updateQuery = squel.update().table(`user_level_completion`)
      .set(`modulesCompletion`, overAllChallengesCompletion)
      .set(`completionCriteria`, JSON.stringify(completionCriteria))
      .set(`score`, totalScore)
      .set(`updatedAt`, `NOW()`, { dontQuote: true });

    result = await mysqlConnection.query(updateQuery.toString(), { type: QueryTypes.UPDATE });
  } else {
    let insertQuery = squel.insert()
      .into(`user_level_completion`)
      .set(`modulesCompletion`, overAllChallengesCompletion)
      .set(`completionCriteria`, JSON.stringify(completionCriteria))
      .set(`score`, totalScore)
      .set(`userId`, userId)
      .set(`levelId`, levelId)
      .set(`createdAt`, `NOW()`, { dontQuote: true })
      .set(`updatedAt`, `NOW()`, { dontQuote: true });

    result = await mysqlConnection.query(insertQuery.toString(), { type: QueryTypes.INSERT });
  }
  return;
};

/**
 * Update User Level
 * @param {Sequelize} mysqlConnection
 * @param {Number} userId
 * @param {Number} levelId
 */
exports.updateUserLevel = async (mysqlConnection, userId, levelId) => {
  let findLevelQuery = squel.select().field(`id`).from(`user_levels`)
    .where(`userId = ?`, userId).where(`levelId = ?`, levelId).where(`deleteFlag = ?`, 0);

  const updateLevelRow = await mysqlConnection.query(findLevelQuery.toString(), { type: QueryTypes.SELECT });
  console.log({ updateLevelRow });

  if (updateLevelRow.length === 0) {
    let insertLevelQuery = squel.insert().into(`user_levels`)
      .set(`userId`, userId).set(`levelId`, levelId)
      .set(`createdAt`, `NOW()`, { dontQuote: true })
      .set(`updatedAt`, `NOW()`, { dontQuote: true });

    await mysqlConnection.query(insertLevelQuery.toString(), { type: QueryTypes.INSERT });
  }
  return;
};

/**
 * Get Level Details from LevelId
 * @param {Sequelize} mysqlConnection
 * @param {Sequelize} mssqlConnection
 * @param {Array} userIds
 * @param {Array} moduleIds
 */
exports.getUserCompletionsData = async (mysqlConnection, mssqlConnection, userIds, moduleIds) => {
  const moduleAccessCollection = await getModuleAccess(mssqlConnection, userIds, moduleIds);
  const moduleScoresCollection = await getUserScores(mssqlConnection, userIds, moduleIds);
  const userChallengesAttemptCollection = await getUserChallengesCompletion(mysqlConnection, userIds, moduleIds);
  const userCompletions = getUserCompletions(moduleAccessCollection, userChallengesAttemptCollection, moduleScoresCollection);
  return userCompletions;
};

/**
 * Get Module Access Completion Date
 * @param {Sequelize} mssqlConnection
 * @param {Array} userIds
 * @param {Array} moduleIds
 */
const getModuleAccess = async (mssqlConnection, userIds, moduleIds) => {
  let mainQuery = squelMssql.select()
    .field(`MCCU.ModuleID AS moduleId`)
    .field(`CONCAT(UD.UserID,'_',MCCU.ModuleID) AS 'key'`)
    .field(`SUM(CASE WHEN MCCU.Delete_Flag = 0 THEN 1  ELSE 0 END) challenges_launched`)
    .from(`Tbl_Map_Module_Comp_Chalenge_user AS MCCU`)
    .join(`Tbl_Userdetail`, `UD`, `UD.User_Email = MCCU.Useremail`)
    .join(`Tbl_Map_Module_Comp_Chalenge`, `MCC`, `MCC.Chalenge_Map_Id = MCCU.Chalenge_id`)
    .join(`Tbl_Chalenge`, `C`, `C.Chal_Id = MCC.Chalenge_id`)
    .where(`MCCU.Useremail != ''`).where(`UD.UserID IN ?`, userIds).where(`MCC.ModuleID IN ?`, moduleIds)
    .where(`UD.Delete_Flag = 0`).where(`MCC.Delete_Flag = 0`).where(`C.Delete_Flag = 0`)
    .group(`MCCU.ModuleID`).group(`UD.UserID`);

  const moduleAccess = await mssqlConnection.query(mainQuery.toString(), { type: QueryTypes.SELECT });
  const moduleAccessCollection = objectify(moduleAccess, 'key');
  return moduleAccessCollection;
};

/**
 * Get Challenge Completion of User
 * @param {Sequelize} mysqlConnection
 * @param {Array} userIds
 * @param {Array} moduleIds
 */
const getUserChallengesCompletion = async (mysqlConnection, userIds, moduleIds) => {
  let mainQuery = squel.select()
    .field(`CONCAT(CA.user_id,'_',C.module_id) AS 'key'`)
    .field(`COUNT(CA.challenge_id) AS challenges_completed`)
    .field(`SUM(CA.timespent) AS total_timespent`);

  let challenges_query = squel.select().field(`id`).from(`challenges`)
    .where(`delete_flag = 0`).where(`module_id IN ?`, moduleIds);

  let subQuery = squel.select()
    .field(`user_id`)
    .field(`challenge_id`)
    .field(`SUM(timespent) 'timespent'`)
    .from('challenge_attempts_bigdaddy')
    .where('challenge_id IN ?', challenges_query)
    .where('user_id IN ?', userIds).where(`completion = 'success'`)
    .group('user_id').group('challenge_id');

  mainQuery.from(`(${subQuery.toString()}) AS CA`)
    .join(squel.select().from(`challenges`), `C`, `C.id = CA.challenge_id`)
    .group(`CA.user_id`).group(`C.module_id`);

  const userChallengesAttempt = await mysqlConnection.query(mainQuery.toString(), { type: QueryTypes.SELECT });
  const userChallengesAttemptCollection = objectify(userChallengesAttempt, 'key');
  return userChallengesAttemptCollection;
};

/**
 * Get Module Access Completion Date
 * @param {Sequelize} mssqlConnection
 * @param {Array} userIds
 * @param {Array} moduleIds
 */
const getUserScores = async (mssqlConnection, userIds, moduleIds) => {
  let mainQuery = squelMssql.select()
    .field(`CONCAT(Scores.UserID,'_',Scores.Module_id) AS 'key'`)
    .field(`SUM(Scores.score) AS score`);

  let subQuery = squelMssql.select()
    .field(`UD.UserID`)
    .field(`S.Challenge_id`)
    .field(`S.Module_id`)
    .field(`MAX(S.Score) AS score`)
    .from(`Tbl_Userdetail AS UD`)
    .join(squelMssql.select().from(`Tbl_Score`), `S`, `S.User_email = UD.User_Email`)
    .where(`S.Module_id IN ?`, moduleIds).where(`UD.UserID IN ?`, userIds)
    .group(`S.User_email`).group(`S.Challenge_id`)
    .group(`S.Module_id`).group(`UD.UserID`);

  mainQuery.from(`(${subQuery.toString()}) AS Scores`).group(`Scores.Module_id`).group(`Scores.UserID`);

  const moduleScores = await mssqlConnection.query(mainQuery.toString(), { type: QueryTypes.SELECT });
  const moduleScoresCollection = objectify(moduleScores, 'key');
  return moduleScoresCollection;
};

/**
 * Calculate Modules Completion Status
 * @param {Object} modulesAttempt
 * @param {Object} challengesAttempt
 */
const getUserCompletions = (modulesAttempt, challengesAttempt, moduleScores) => {
  let totalChallengesCompleted = 0;
  let totalChallengesLaunched = 0;
  let totalScore = 0;
  let moduleCompletion = [];

  for (const key in modulesAttempt) {
    const { moduleId, challenges_launched } = modulesAttempt[key];
    let challenges_completed = challengesAttempt.hasOwnProperty(key) ? challengesAttempt[key].challenges_completed : 0;
    let moduleScore = moduleScores.hasOwnProperty(key) ? moduleScores[key].score : 0;
    let moduleCompleted = challenges_launched === challenges_completed;
    moduleCompletion.push({ moduleId, challenges_launched, challenges_completed, moduleScore, moduleCompleted });
    totalChallengesCompleted += challenges_completed;
    totalChallengesLaunched += challenges_launched;
    totalScore += moduleScore;
  }
  let overAllChallengesCompletion = Math.round((totalChallengesCompleted / totalChallengesLaunched) * 100);
  let modulesCompleted = moduleCompletion.filter((row) => { return row.moduleCompleted === true; }).map((row) => row.moduleId);
  let userCompletions = { moduleCompletion, modulesCompleted, totalScore, overAllChallengesCompletion, totalChallengesCompleted, totalChallengesLaunched };
  return userCompletions;
};