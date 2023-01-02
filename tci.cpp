// TODO
#undef UNICODE
#undef _UNICODE

#include <napi.h>
#include "tci.h"
#include <variant>

typedef char Char;
/**
 * node-api tci wrapper
 */
class TCI : public Napi::ObjectWrap<TCI>
{
private:
	TCIState state = TCI_SUCCESS;
	TCIError *error = NULL;
	TCIEnvironment *environment = NULL;
	TCIConnection *connection = NULL;
	TCITransaction *transaction = NULL;
	TCIStatement *statement = NULL;
	TCIResultSet *resultSet = NULL;
	Char sqlcode[5];
	TBErrorCode errorCode;
	Char errorMessage[1000];
	short isNull;
	Napi::Env env;
	bool typeCast = true;

public:
	TCI(const Napi::CallbackInfo &info) : Napi::ObjectWrap<TCI>(info), env(info.Env())
	{
	}

	~TCI()
	{
		free();
	}

	static void Init(Napi::Env env, Napi::Object exports)
	{
		// define the js class wrapper
		auto tci = DefineClass(env, "TCI", {
			InstanceMethod<&TCI::connect>("connect"), 
			InstanceMethod<&TCI::executeDirect>("executeDirect"), 
			InstanceMethod<&TCI::prepare>("prepare"), 
			InstanceMethod<&TCI::execute>("execute"), 
			InstanceMethod<&TCI::setParam>("setParam"), 
			InstanceMethod<&TCI::fetch>("fetch"), 
			InstanceMethod<&TCI::getState>("getState"), 
			InstanceMethod<&TCI::getResultSetAttribute>("getResultSetAttribute"), 
			InstanceMethod<&TCI::getResultSetStringAttribute>("getResultSetStringAttribute"), 
			InstanceMethod<&TCI::getValue>("getValue"), 
			InstanceMethod<&TCI::getValueAsBuffer>("getValueAsBuffer"), 
			InstanceMethod<&TCI::getQueryType>("getQueryType"), 
			InstanceMethod<&TCI::close>("close"), 
			InstanceMethod<&TCI::setTypeCast>("setTypeCast"),
			InstanceMethod<&TCI::beginTransaction>("beginTransaction"),
			InstanceMethod<&TCI::commit>("commit"),
			InstanceMethod<&TCI::rollback>("rollback")});
		exports.Set("TCI", tci);
	}

	void connect(const Napi::CallbackInfo &info)
	{
		if (info.Length() != 1 || !info[0].IsObject())
			throw Napi::Error::New(env, "connect is missing config argument {url,user,password}");

		Napi::Object config = info[0].As<Napi::Object>();

		if (!(config.HasOwnProperty("url") && config.Get("url").IsString()))
			throw Napi::Error::New(env, "connect requires a string url");
		if (!(config.HasOwnProperty("user") && config.Get("user").IsString()))
			throw Napi::Error::New(env, "connect requires a string user");
		if (!(config.HasOwnProperty("password") && config.Get("password").IsString()))
			throw Napi::Error::New(env, "connect requires a string password");

		std::string url = config.Get("url").As<Napi::String>();
		std::string user = config.Get("user").As<Napi::String>();
		std::string password = config.Get("password").As<Napi::String>();

		if ((state = TCIAllocEnvironment(&environment) || (state = TCIAllocError(environment, &error))))
		{
			TCIGetEnvironmentError(environment, 1, errorMessage, sizeof(errorMessage), NULL, NULL);
			free();
			Napi::Error::New(env, errorMessage);
		}

		tci(TCIAllocConnection(environment, error, &connection));
		tci(TCIAllocTransaction(environment, error, &transaction));
		tci(TCIConnect(connection, &url[0]));
		tci(TCILogin(connection, &user[0], &password[0]));
		tci(TCIAllocStatement(connection, error, &statement));
		tci(TCIAllocResultSet(statement, error, &resultSet));
	}

	void setTypeCast(const Napi::CallbackInfo &info)
	{
		typeCast = info[0].As<Napi::Boolean>();
	}

	void executeDirect(const Napi::CallbackInfo &info)
	{
		std::string query = info[0].As<Napi::String>().Utf8Value();
		tci(TCIExecuteDirect(resultSet, &query[0], 1, 0));
	}

	void prepare(const Napi::CallbackInfo &info)
	{
		auto query = info[0].As<Napi::String>().Utf8Value();
		tci(TCIPrepare(statement, &query[0]));
	}

	void execute(const Napi::CallbackInfo &info)
	{
		tci(TCIExecute(resultSet, 1, 0));
	}

	void setParam(const Napi::CallbackInfo &info)
	{
		setData(info[0], info[1]);
	}

	void beginTransaction(const Napi::CallbackInfo &info)
	{
		tci(TCIBeginTransaction(transaction, connection));
	}

	void commit(const Napi::CallbackInfo &info)
	{
		tci(TCICommitTransaction(transaction));
	}

	void rollback(const Napi::CallbackInfo &info)
	{
		tci(TCIRollbackTransaction(transaction));
	}

	void setData(Napi::Value nameOrPosition, Napi::Value value)
	{
		auto typeAndValue = getTciTypeAndValue(value);
		auto type = typeAndValue.first;
		auto data = typeAndValue.second;
		auto size = sizeof(data);

		if (nameOrPosition.IsNumber())
		{
			auto position = nameOrPosition.As<Napi::Number>().Uint32Value() + 1;
			if (type == TCI_C_CHAR) // TODO: string handling get<std::string> require libcpp
				tci(TCISetData(resultSet, position, value.ToString().Utf8Value().data(), size, type, NULL));
			else if (type == TCI_C_BYTE)
			{
				auto buffer = value.As<Napi::Buffer<unsigned char>>();
				tci(TCISetData(resultSet, position, buffer.Data(), buffer.Length(), type, NULL));
			}
			else
				tci(TCISetData(resultSet, position, &data, size, type, NULL));
		}
		else
		{
			auto name = nameOrPosition.As<Napi::String>().Utf8Value();
			if (type == TCI_C_CHAR)
				tci(TCISetDataByName(resultSet, &name[0], value.ToString().Utf8Value().data(), size, type, NULL));
			else if (type == TCI_C_BYTE)
			{
				auto buffer = value.As<Napi::Buffer<unsigned char>>();
				tci(TCISetDataByName(resultSet, &name[0], buffer.Data(), buffer.Length(), type, NULL));
			}
			else
				tci(TCISetDataByName(resultSet, &name[0], &data, size, type, NULL));
		}
	}

	std::pair<Int2, std::variant<bool, int32_t, int64_t, double, std::string>> getTciTypeAndValue(Napi::Value value)
	{
		if (value.IsBoolean())
		{
			return std::pair(TCI_C_INT1, value.As<Napi::Boolean>().Value());
		}
		else if (value.IsNumber())
		{
			auto number = value.As<Napi::Number>();
			if (number.IsBigInt())
			{
				return std::pair(TCI_C_INT8, value.As<Napi::Number>().Int64Value());
			}
			else if (isNapiValueInteger(env, number))
			{
				return std::pair(TCI_C_INT4, value.As<Napi::Number>().Int32Value());
			}
			else
			{
				return std::pair(TCI_C_DOUBLE, value.As<Napi::Number>().DoubleValue());
			}
		}
		else if (value.IsBuffer())
		{
			return std::pair(TCI_C_BYTE, -1);
		}
		else
		{
			return std::pair(TCI_C_CHAR, value.ToString().Utf8Value());
		}
	}

	Napi::Value getQueryType(const Napi::CallbackInfo &info)
	{
		auto queryType = getResultSetAttribute(TCI_ATTR_QUERY_TYPE);
		if (sel_class(queryType))
			return Napi::String::New(env, "SELECT");
		if (upd_class(queryType))
			return Napi::String::New(env, "UPDATE");
		if (ddl_class(queryType))
			return Napi::String::New(env, "SCHEMA");
		return Napi::Number::New(env, queryType);
	}

	Napi::Value getResultSetAttribute(const Napi::CallbackInfo &info)
	{
		auto attrKey = info[0].As<Napi::Number>().Uint32Value();
		auto col = info.Length() > 1 ? info[1].As<Napi::Number>() : 1;
		auto attr = getResultSetAttribute(attrKey, col);
		return Napi::Number::New(env, attr);
	}

	int getResultSetAttribute(int attrKey, int col = 1)
	{
		Uint2 value = 0;
		tci(TCIGetResultSetAttribute(resultSet, attrKey, col, &value, sizeof(value), NULL));
		return value;
	}

	Napi::Value getResultSetStringAttribute(const Napi::CallbackInfo &info)
	{
		Char value[MAXIDENTSIZE];
		auto attrKey = info[0].As<Napi::Number>().Uint32Value();
		auto col = info.Length() > 1 ? info[1].As<Napi::Number>() : 1;
		tci(TCIGetResultSetAttribute(resultSet, attrKey, col, &value, sizeof(value), NULL));
		return Napi::String::New(env, value);
	}

	Napi::Value fetch(const Napi::CallbackInfo &info)
	{
		auto scrollMode = info.Length() > 0 ? info[0].As<Napi::Number>().Uint32Value() : TCI_FETCH_NEXT;

		state = TCIFetch(resultSet, 1, scrollMode, 0);
		if (state == TCI_SUCCESS)
			return Napi::Boolean::New(env, true);
		if (state == TCI_NO_DATA_FOUND)
			return Napi::Boolean::New(env, false);
		else
			tci(state);

		return env.Undefined();
	}

	Napi::Value getState(const Napi::CallbackInfo &info)
	{
		return Napi::Number::New(env, state);
	}

	Napi::Value getValue(TCIColumnnumber col, int sqlType, bool typeCast)
	{
		if (!typeCast)
		{
			switch (sqlType)
			{
			case TCI_SQL_BLOB:
			case TCI_SQL_BINARY:
			case TCI_SQL_BITSHORT:
			case TCI_SQL_BIT:
				return getBitsValue(col);
			default:
				return getStringValue(col);
			}
		}

		switch (sqlType)
		{
		// logical
		case TCI_SQL_BOOL:
			return getBooleanValue(col);
		// numerical
		case TCI_SQL_TINYINT:
		case TCI_SQL_SMALLINT:
		case TCI_SQL_INTEGER:
			return getIntegerValue(col);
		case TCI_SQL_BIGINT:
			return getBigIntValue(col);
		case TCI_SQL_FLOAT:
			return getFloatValue(col);
		case TCI_SQL_DOUBLE:
		case TCI_SQL_NUMERIC:
			return getDoubleValue(col);
		case TCI_SQL_BLOB:
		case TCI_SQL_BINARY:
			return getBlobValue(col);
		case TCI_SQL_BITSHORT:
		case TCI_SQL_BIT:
			return getBitsValue(col);
		// character
		case TCI_SQL_CHAR:
		case TCI_SQL_VARCHAR:
		case TCI_SQL_CLOB:
		default:
			return getStringValue(col);
		}
	}

	Napi::Value getValue(const Napi::CallbackInfo &info)
	{
		TCIColumnnumber col = info[0].As<Napi::Number>().Uint32Value();
		auto sqlType = info[1].As<Napi::Number>().Uint32Value();
		auto typeCast = info.Length() == 3 ? info[2].As<Napi::Boolean>() : this->typeCast;
		this->isNull = 0;
		auto value = getValue(col, sqlType, typeCast);
		return isNull ? env.Null() : value;
	}

	Napi::Value getValueAsBuffer(const Napi::CallbackInfo &info)
	{
		TCIColumnnumber col = info[0].As<Napi::Number>().Uint32Value();
		auto bufferSize = info[1].As<Napi::Number>().Int32Value();
		this->isNull = 0;
		Napi::Value value = getBufferValue(col, bufferSize);
		return isNull ? env.Null() : value;
	}

	Napi::Value getBooleanValue(TCIColumnnumber &colNumber)
	{
		bool b;
		tci(TCIGetData(resultSet, colNumber, &b, sizeof(b), NULL, TCI_C_INT1, &isNull));
		return Napi::Boolean::New(env, b);
	}

	Napi::Value getIntegerValue(TCIColumnnumber &colNumber)
	{
		int i;
		tci(TCIGetData(resultSet, colNumber, &i, sizeof(i), NULL, TCI_C_INT4, &isNull));
		return Napi::Number::New(env, i);
	}

	Napi::Value getBigIntValue(TCIColumnnumber &colNumber)
	{
		long long ll;
		tci(TCIGetData(resultSet, colNumber, &ll, sizeof(ll), NULL, TCI_C_INT8, &isNull));
		return Napi::Number::New(env, ll);
	}

	Napi::Value getFloatValue(TCIColumnnumber &colNumber)
	{
		float f;
		tci(TCIGetData(resultSet, colNumber, &f, sizeof(f), NULL, TCI_C_FLOAT, &isNull));
		return Napi::Number::New(env, f);
	}

	Napi::Value getDoubleValue(TCIColumnnumber &colNumber)
	{
		double d;
		tci(TCIGetData(resultSet, colNumber, &d, sizeof(d), NULL, TCI_C_DOUBLE, &isNull));
		return Napi::Number::New(env, d);
	}

	Napi::Value getBlobValue(TCIColumnnumber &colNumber)
	{
		Int4 blobSize;
		tci(TCIGetDataSize(resultSet, colNumber, TCI_C_BYTE, &blobSize, &isNull));
		auto buffer = Napi::Buffer<unsigned char>::New(env, blobSize);
		tci(TCIGetData(resultSet, colNumber, buffer.Data(), blobSize, NULL, TCI_C_BYTE, &isNull));
		return buffer;
	}

	Napi::Value getBitsValue(TCIColumnnumber &colNumber)
	{
		Int4 bitsSize;
		tci(TCIGetDataSize(resultSet, colNumber, TCI_C_CHAR, &bitsSize, &isNull));
		std::string str(bitsSize - 2, '0');
		tci(TCIGetData(resultSet, colNumber, str.data(), bitsSize, NULL, TCI_C_CHAR, &isNull));
		return Napi::String::New(env, str);
		;
	}

	Napi::Value getBufferValue(TCIColumnnumber &colNumber, Int4 &bufferSize)
	{
		Int4 byteSize;
		auto buffer = Napi::Buffer<unsigned char>::New(env, bufferSize);
		this->state = TCIGetData(resultSet, colNumber, buffer.Data(), bufferSize, &byteSize, TCI_C_CHAR, &isNull);
		if (this->state != TCI_DATA_TRUNCATION)
		{
			tci(this->state); // error handling
		}
		if (bufferSize == byteSize)
		{
			return buffer;
		}
		else
		{
			return buffer.Copy(env, buffer.Data(), byteSize);
		}
	}

	Napi::Value getStringValue(TCIColumnnumber &colNumber)
	{
		Int4 charLength;
		Int4 byteSize;
		tci(TCIGetDataSize(resultSet, colNumber, TCI_C_CHAR, &byteSize, &isNull));
		tci(TCIGetDataCharLength(resultSet, colNumber, &charLength, &isNull));
		auto size = std::max(charLength, byteSize) + 1;
		if (isNull)
			return env.Null();
		if (byteSize == 0 || charLength == 0)
			return Napi::String::New(env, "");

		std::string str(charLength, ' ');
		tci(TCIGetData(resultSet, colNumber, str.data(), size, NULL, TCI_C_CHAR, &isNull));
		return Napi::String::New(env, str);
	}

	void close(const Napi::CallbackInfo &info)
	{
		free();
	}

	void free()
	{
		if (resultSet)
			TCIFreeResultSet(resultSet);
		if (statement)
			TCIFreeStatement(statement);
		if(transaction)
			TCIFreeTransaction(transaction);	
		if (connection)
			TCIFreeConnection(connection);
		if (error)
			TCIFreeError(error);
		if (environment)
			TCIFreeEnvironment(environment);
	}

	void tci(TCIState state)
	{
		this->state = state;
		if (state)
		{
			TCIGetError(error, 1, 1, errorMessage, sizeof(errorMessage), &errorCode, sqlcode);
			printf("TCIError %d: %s\n SQLCode: %s\n", errorCode, errorMessage, sqlcode);
			throw Napi::Error::New(env, errorMessage);
		}
	}

	static bool isNapiValueInteger(Napi::Env &env, Napi::Value &num)
	{
		return env.Global()
			.Get("Number")
			.ToObject()
			.Get("isInteger")
			.As<Napi::Function>()
			.Call({num})
			.ToBoolean()
			.Value();
	}
};

static void DefineConstants(Napi::Env env, Napi::Object exports)
{
	auto attribute = Napi::Object::New(env);
	attribute.Set("TCI_ATTR_COLUMN_COUNT", TCI_ATTR_COLUMN_COUNT);
	attribute.Set("TCI_ATTR_COLUMN_NAME", TCI_ATTR_COLUMN_NAME);
	attribute.Set("TCI_ATTR_COLUMN_TYPE", TCI_ATTR_COLUMN_TYPE);
	attribute.Set("TCI_ATTR_RECORDS_TOUCHED", TCI_ATTR_RECORDS_TOUCHED);
	exports.Set("Attribute", attribute);

	auto state = Napi::Object::New(env);
	state.Set("SUCCESS", TCI_SUCCESS);
	state.Set("ERROR", TCI_ERROR);
	state.Set("NO_DATA_FOUND", TCI_NO_DATA_FOUND);
	state.Set("DATA_TRUNCATION", TCI_DATA_TRUNCATION);
	exports.Set("State", state);

	auto sqlType = Napi::Object::New(env);
	sqlType.Set("BOOL", TCI_SQL_BOOL);
	sqlType.Set("TINYINT", TCI_SQL_TINYINT);
	sqlType.Set("SMALLINT", TCI_SQL_SMALLINT);
	sqlType.Set("INTEGER", TCI_SQL_INTEGER);
	sqlType.Set("NUMERIC", TCI_SQL_NUMERIC);
	sqlType.Set("FLOAT", TCI_SQL_FLOAT);
	sqlType.Set("DOUBLE", TCI_SQL_DOUBLE);
	sqlType.Set("CHAR", TCI_SQL_CHAR);
	sqlType.Set("VARCHAR", TCI_SQL_VARCHAR);
	sqlType.Set("BINARY", TCI_SQL_BINARY);
	sqlType.Set("BIT", TCI_SQL_BIT);
	sqlType.Set("BLOB", TCI_SQL_BLOB);
	sqlType.Set("BITSHORT", TCI_SQL_BITSHORT);
	sqlType.Set("BIGINT", TCI_SQL_BIGINT);
	sqlType.Set("CLOB", TCI_SQL_CLOB);
	sqlType.Set("DATE", TCI_SQL_DATE);
	sqlType.Set("DATE_YEAR", TCI_SQL_DATE_YEAR);
	sqlType.Set("DATE_YEAR_TO_MONTH", TCI_SQL_DATE_YEAR_TO_MONTH);
	sqlType.Set("DATE_YEAR_TO_DAY", TCI_SQL_DATE_YEAR_TO_DAY);
	sqlType.Set("DATE_YEAR_TO_HOUR", TCI_SQL_DATE_YEAR_TO_HOUR);
	sqlType.Set("DATE_YEAR_TO_MINUTE", TCI_SQL_DATE_YEAR_TO_MINUTE);
	sqlType.Set("DATE_YEAR_TO_SECOND", TCI_SQL_DATE_YEAR_TO_SECOND);
	sqlType.Set("DATE_YEAR_TO_MILLISECOND", TCI_SQL_DATE_YEAR_TO_MILLISECOND);
	sqlType.Set("DATE_MONTH", TCI_SQL_DATE_MONTH);
	sqlType.Set("DATE_MONTH_TO_DAY", TCI_SQL_DATE_MONTH_TO_DAY);
	sqlType.Set("DATE_MONTH_TO_HOUR", TCI_SQL_DATE_MONTH_TO_HOUR);
	sqlType.Set("DATE_MONTH_TO_MINUTE", TCI_SQL_DATE_MONTH_TO_MINUTE);
	sqlType.Set("DATE_MONTH_TO_SECOND", TCI_SQL_DATE_MONTH_TO_SECOND);
	sqlType.Set("DATE_MONTH_TO_MILLISECOND", TCI_SQL_DATE_MONTH_TO_MILLISECOND);
	sqlType.Set("DATE_DAY", TCI_SQL_DATE_DAY);
	sqlType.Set("DATE_DAY_TO_HOUR", TCI_SQL_DATE_DAY_TO_HOUR);
	sqlType.Set("DATE_DAY_TO_MINUTE", TCI_SQL_DATE_DAY_TO_MINUTE);
	sqlType.Set("DATE_DAY_TO_SECOND", TCI_SQL_DATE_DAY_TO_SECOND);
	sqlType.Set("DATE_DAY_TO_MILLISECOND", TCI_SQL_DATE_DAY_TO_MILLISECOND);
	sqlType.Set("DATE_HOUR", TCI_SQL_DATE_HOUR);
	sqlType.Set("DATE_HOUR_TO_MINUTE", TCI_SQL_DATE_HOUR_TO_MINUTE);
	sqlType.Set("DATE_HOUR_TO_SECOND", TCI_SQL_DATE_HOUR_TO_SECOND);
	sqlType.Set("DATE_HOUR_TO_MILLISECOND", TCI_SQL_DATE_HOUR_TO_MILLISECOND);
	sqlType.Set("DATE_MINUTE", TCI_SQL_DATE_MINUTE);
	sqlType.Set("DATE_MINUTE_TO_SECOND", TCI_SQL_DATE_MINUTE_TO_SECOND);
	sqlType.Set("DATE_MINUTE_TO_MILLISECOND", TCI_SQL_DATE_MINUTE_TO_MILLISECOND);
	sqlType.Set("DATE_SECOND", TCI_SQL_DATE_SECOND);
	sqlType.Set("DATE_SECOND_TO_MILLISECOND", TCI_SQL_DATE_SECOND_TO_MILLISECOND);
	sqlType.Set("DATE_MILLISECOND", TCI_SQL_DATE_MILLISECOND);
	sqlType.Set("TIME", TCI_SQL_TIME);
	sqlType.Set("TIMESTAMP", TCI_SQL_TIMESTAMP);
	sqlType.Set("INTERVAL", TCI_SQL_TYPE_INTERVAL);
	sqlType.Set("INTERVAL_YEAR", TCI_SQL_INTERVAL_YEAR);
	sqlType.Set("INTERVAL_YEAR_TO_MONTH", TCI_SQL_INTERVAL_YEAR_TO_MONTH);
	sqlType.Set("INTERVAL_MONTH", TCI_SQL_INTERVAL_MONTH);
	sqlType.Set("INTERVAL_DAY", TCI_SQL_INTERVAL_DAY);
	sqlType.Set("INTERVAL_DAY_TO_HOUR", TCI_SQL_INTERVAL_DAY_TO_HOUR);
	sqlType.Set("INTERVAL_DAY_TO_MINUTE", TCI_SQL_INTERVAL_DAY_TO_MINUTE);
	sqlType.Set("INTERVAL_DAY_TO_SECOND", TCI_SQL_INTERVAL_DAY_TO_SECOND);
	sqlType.Set("INTERVAL_DAY_TO_MILLISECOND", TCI_SQL_INTERVAL_DAY_TO_MILLISECOND);
	sqlType.Set("INTERVAL_HOUR", TCI_SQL_INTERVAL_HOUR);
	sqlType.Set("INTERVAL_HOUR_TO_MINUTE", TCI_SQL_INTERVAL_HOUR_TO_MINUTE);
	sqlType.Set("INTERVAL_HOUR_TO_SECOND", TCI_SQL_INTERVAL_HOUR_TO_SECOND);
	sqlType.Set("INTERVAL_HOUR_TO_MILLISECOND", TCI_SQL_INTERVAL_HOUR_TO_MILLISECOND);
	sqlType.Set("INTERVAL_MINUTE", TCI_SQL_INTERVAL_MINUTE);
	sqlType.Set("INTERVAL_MINUTE_TO_SECOND", TCI_SQL_INTERVAL_MINUTE_TO_SECOND);
	sqlType.Set("INTERVAL_MINUTE_TO_MILLISECOND", TCI_SQL_INTERVAL_MINUTE_TO_MILLISECOND);
	sqlType.Set("INTERVAL_SECOND", TCI_SQL_INTERVAL_SECOND);
	sqlType.Set("INTERVAL_SECOND_TO_MILLISECOND", TCI_SQL_INTERVAL_SECOND_TO_MILLISECOND);
	sqlType.Set("INTERVAL_MILLISECOND", TCI_SQL_INTERVAL_MILLISECOND);

	exports.Set("SqlType", sqlType);
}

// Initialize native add-on
Napi::Object Init(Napi::Env env, Napi::Object exports)
{
	TCI::Init(env, exports);
	DefineConstants(env, exports);
	return exports;
}

NODE_API_MODULE(transbase, Init);
